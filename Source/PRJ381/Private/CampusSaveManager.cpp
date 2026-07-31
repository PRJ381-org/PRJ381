// CampusSaveManager.cpp

#include "CampusSaveManager.h"

#include "JsonObjectConverter.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "Async/Async.h"

namespace
{
	const TCHAR* kSaveFileName = TEXT("campus_session.json");
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

FString UCampusSaveManager::DefaultSlotPath()
{
	return FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("SaveGames"), kSaveFileName);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

void UCampusSaveManager::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	// Populate Current from disk (or defaults on first run).
	LoadGame();
}

void UCampusSaveManager::Deinitialize()
{
	// Cancel any pending debounced flush and persist the last change now,
	// so quitting never loses an in-flight save.
	if (FlushHandle.IsValid())
	{
		FTSTicker::GetCoreTicker().RemoveTicker(FlushHandle);
		FlushHandle.Reset();
	}
	if (bDirty)
	{
		SaveGame(); // synchronous
	}
	Super::Deinitialize();
}

// ---------------------------------------------------------------------------
// Static IO helpers
// ---------------------------------------------------------------------------

FString UCampusSaveManager::ToJson(const FCampusSaveData& Data)
{
	FString Out;
	// Indent = 4 for a human-readable, debuggable file.
	FJsonObjectConverter::UStructToJsonObjectString(Data, Out, 0, 0, 4);
	return Out;
}

bool UCampusSaveManager::FromJson(const FString& Json, FCampusSaveData& OutData)
{
	return FJsonObjectConverter::JsonObjectStringToUStruct(Json, &OutData, 0, 0);
}

bool UCampusSaveManager::SaveToFile(const FString& FilePath, const FCampusSaveData& Data)
{
	const FString Json = ToJson(Data);
	if (Json.IsEmpty())
	{
		UE_LOG(LogTemp, Warning, TEXT("CampusSave: serialisation produced empty JSON."));
		return false;
	}

	IFileManager& FM = IFileManager::Get();
	FM.MakeDirectory(*FPaths::GetPath(FilePath), /*Tree*/ true);

	// 1) Write to a temp file first.
	const FString TmpPath = FilePath + TEXT(".tmp");
	if (!FFileHelper::SaveStringToFile(Json, *TmpPath))
	{
		UE_LOG(LogTemp, Warning, TEXT("CampusSave: could not write temp %s"), *TmpPath);
		return false;
	}

	// 2) Back up the existing main file (best-effort) before replacing it.
	if (FM.FileExists(*FilePath))
	{
		FM.Copy(*(FilePath + TEXT(".bak")), *FilePath, /*ReplaceExisting*/ true);
	}

	// 3) Atomically move temp into place.
	if (!FM.Move(*FilePath, *TmpPath, /*Replace*/ true))
	{
		UE_LOG(LogTemp, Warning, TEXT("CampusSave: could not move temp into %s"), *FilePath);
		return false;
	}

	return true;
}

bool UCampusSaveManager::LoadFromFile(const FString& FilePath, FCampusSaveData& OutData)
{
	IFileManager& FM = IFileManager::Get();

	auto TryLoad = [&FM, &OutData](const FString& Path) -> bool
	{
		if (!FM.FileExists(*Path))
		{
			return false;
		}
		FString Json;
		if (!FFileHelper::LoadFileToString(Json, *Path))
		{
			return false;
		}
		return UCampusSaveManager::FromJson(Json, OutData);
	};

	// Primary file first.
	if (TryLoad(FilePath))
	{
		return true;
	}

	// Fall back to backup on corruption/parse failure.
	const FString BakPath = FilePath + TEXT(".bak");
	if (TryLoad(BakPath))
	{
		UE_LOG(LogTemp, Warning, TEXT("CampusSave: recovered from backup %s"), *BakPath);
		return true;
	}

	return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

bool UCampusSaveManager::HasSaveData() const
{
	return IFileManager::Get().FileExists(*DefaultSlotPath());
}

bool UCampusSaveManager::LoadGame()
{
	FCampusSaveData Loaded;
	if (LoadFromFile(DefaultSlotPath(), Loaded))
	{
		Current = Migrate(Loaded);
		return true;
	}

	// No usable save → defaults.
	Current = FCampusSaveData();
	return false;
}

bool UCampusSaveManager::SaveGame()
{
	Current.LastSaved = FDateTime::UtcNow();
	Current.SchemaVersion = CurrentSchemaVersion;
	bDirty = false;
	return SaveToFile(DefaultSlotPath(), Current);
}

void UCampusSaveManager::SaveGameAsync()
{
	bDirty = true;
	ScheduleFlush();
}

void UCampusSaveManager::ScheduleFlush()
{
	if (FlushHandle.IsValid())
	{
		return; // a flush is already pending; the debounce window covers this change
	}
	FlushHandle = FTSTicker::GetCoreTicker().AddTicker(
		FTickerDelegate::CreateUObject(this, &UCampusSaveManager::FlushTick),
		DebounceSeconds);
}

bool UCampusSaveManager::FlushTick(float /*DeltaTime*/)
{
	FlushHandle.Reset();
	FlushNow();
	return false; // one-shot; do not reschedule
}

void UCampusSaveManager::FlushNow()
{
	if (!bDirty)
	{
		return;
	}

	Current.LastSaved = FDateTime::UtcNow();
	Current.SchemaVersion = CurrentSchemaVersion;
	bDirty = false;

	// Copy state and write off the game thread so we never hitch rendering.
	const FCampusSaveData Snapshot = Current;
	const FString Path = DefaultSlotPath();
	Async(EAsyncExecution::ThreadPool, [Snapshot, Path]()
	{
		UCampusSaveManager::SaveToFile(Path, Snapshot);
	});
}

void UCampusSaveManager::DeleteSaveData()
{
	IFileManager& FM = IFileManager::Get();
	const FString Path = DefaultSlotPath();
	FM.Delete(*Path, /*RequireExists*/ false, /*EvenReadOnly*/ true, /*Quiet*/ true);
	FM.Delete(*(Path + TEXT(".bak")), false, true, true);
	Current = FCampusSaveData();
	bDirty = false;
}

void UCampusSaveManager::MarkAreaVisited(const FString& Area)
{
	Current.VisitedAreas.AddUnique(Area);
	SaveGameAsync();
}

void UCampusSaveManager::MarkHotspotViewed(const FString& HotspotId)
{
	Current.ViewedHotspotIds.AddUnique(HotspotId);
	SaveGameAsync();
}

void UCampusSaveManager::SetPlayerTransform(FVector Location, FRotator Rotation)
{
	Current.PlayerLocation = Location;
	Current.PlayerRotation = Rotation;
	// Intentionally not auto-saved (called frequently). Caller triggers a save.
}

void UCampusSaveManager::SetSessionId(const FString& InSessionId)
{
	Current.SessionId = InSessionId;
	SaveGame(); // one-time-ish and important, so persist synchronously
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

FCampusSaveData UCampusSaveManager::Migrate(FCampusSaveData In)
{
	if (In.SchemaVersion < CurrentSchemaVersion)
	{
		// v1 is the baseline. When you add fields in future versions, set their
		// defaults here based on In.SchemaVersion before bumping it.
		In.SchemaVersion = CurrentSchemaVersion;
	}
	return In;
}
