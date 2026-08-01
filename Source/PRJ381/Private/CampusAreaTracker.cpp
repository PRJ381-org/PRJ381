// CampusAreaTracker.cpp

#include "CampusAreaTracker.h"
#include "CampusBackendClient.h"
#include "CampusIdentitySubsystem.h"

#include "Engine/World.h"
#include "Engine/GameInstance.h"
#include "UObject/UObjectGlobals.h" // FCoreUObjectDelegates

void UCampusAreaTracker::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	// Fires after any level finishes loading (including gate travel).
	PostLoadMapHandle = FCoreUObjectDelegates::PostLoadMapWithWorld.AddUObject(
		this, &UCampusAreaTracker::OnPostLoadMap);

	// So the first area_enter can wait for the session id if needed.
	if (UGameInstance* GI = GetGameInstance())
	{
		if (UCampusIdentitySubsystem* Id = GI->GetSubsystem<UCampusIdentitySubsystem>())
		{
			Id->OnSessionReady.AddDynamic(this, &UCampusAreaTracker::HandleSessionReady);
		}
	}
}

void UCampusAreaTracker::Deinitialize()
{
	FCoreUObjectDelegates::PostLoadMapWithWorld.Remove(PostLoadMapHandle);

	if (UGameInstance* GI = GetGameInstance())
	{
		if (UCampusIdentitySubsystem* Id = GI->GetSubsystem<UCampusIdentitySubsystem>())
		{
			Id->OnSessionReady.RemoveDynamic(this, &UCampusAreaTracker::HandleSessionReady);
		}
	}

	// Best-effort final exit (HTTP on hard quit may not complete).
	if (!CurrentArea.IsEmpty() && bEnterSent)
	{
		const int32 DurationMs =
			FMath::Max(0, (int32)((FPlatformTime::Seconds() - EnterTimeSeconds) * 1000.0));
		SendAreaEvent(TEXT("area_exit"), CurrentArea, DurationMs);
	}

	Super::Deinitialize();
}

void UCampusAreaTracker::OnPostLoadMap(UWorld* LoadedWorld)
{
	UpdateAreaFromWorld(LoadedWorld);
}

void UCampusAreaTracker::HandleSessionReady(const FString& /*InSessionId*/)
{
	UpdateAreaFromWorld(GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr);
}

FString UCampusAreaTracker::DeriveArea(UWorld* World)
{
	if (!World)
	{
		return FString();
	}
	FString MapName = World->GetMapName();
	MapName.RemoveFromStart(World->StreamingLevelsPrefix); // strip PIE prefix e.g. "UEDPIE_0_"
	MapName.RemoveFromStart(TEXT("LVL_"));                 // "LVL_TechnoLab" -> "TechnoLab"
	return MapName;
}

void UCampusAreaTracker::UpdateAreaFromWorld(UWorld* World)
{
	const FString NewArea = DeriveArea(World);
	if (NewArea.IsEmpty())
	{
		return;
	}

	bool bSessionReady = false;
	if (const UGameInstance* GI = GetGameInstance())
	{
		if (const UCampusIdentitySubsystem* Id = GI->GetSubsystem<UCampusIdentitySubsystem>())
		{
			bSessionReady = Id->IsReady() && !Id->GetSessionId().IsEmpty();
		}
	}

	// Same area as before (e.g. session became ready after the map loaded).
	if (NewArea == CurrentArea)
	{
		if (!bEnterSent && bSessionReady)
		{
			SendAreaEvent(TEXT("area_enter"), CurrentArea, 0);
			bEnterSent = true;
		}
		return;
	}

	// Moved to a new area: close out the previous one, then enter the new.
	if (!CurrentArea.IsEmpty() && bEnterSent)
	{
		const int32 DurationMs =
			FMath::Max(0, (int32)((FPlatformTime::Seconds() - EnterTimeSeconds) * 1000.0));
		SendAreaEvent(TEXT("area_exit"), CurrentArea, DurationMs);
	}

	CurrentArea = NewArea;
	EnterTimeSeconds = FPlatformTime::Seconds();
	bEnterSent = false;

	if (bSessionReady)
	{
		SendAreaEvent(TEXT("area_enter"), CurrentArea, 0);
		bEnterSent = true;
	}
}

void UCampusAreaTracker::SendAreaEvent(const FString& EventType, const FString& Area, int32 DurationMs)
{
	const UGameInstance* GI = GetGameInstance();
	if (!GI)
	{
		return;
	}

	FString SessionId;
	if (const UCampusIdentitySubsystem* Id = GI->GetSubsystem<UCampusIdentitySubsystem>())
	{
		SessionId = Id->GetSessionId();
	}
	if (SessionId.IsEmpty())
	{
		return; // not ready yet; will fire once the session resolves
	}

	if (UCampusBackendClient* Backend = GI->GetSubsystem<UCampusBackendClient>())
	{
		Backend->SendEvent(SessionId, EventType, Area, TEXT(""), DurationMs);
	}
}
