// CampusSaveManager.h
// GameInstance subsystem that owns local save/load of session state.
//
// NOTE: no MODULE_API export macro is used, so this compiles as-is in a single
// game module and is callable from Blueprints. If you ever reference it from a
// SEPARATE module, add "YOURMODULE_API" before the class name.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Containers/Ticker.h"
#include "CampusSaveData.h"
#include "CampusSaveManager.generated.h"

UCLASS()
class UCampusSaveManager : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	/** Current on-disk schema version the code understands. */
	static constexpr int32 CurrentSchemaVersion = 1;

	// USubsystem lifecycle
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// ---- Blueprint-callable API -------------------------------------------

	/** Synchronous save. Use on quit / focus-loss where you must finish now. */
	UFUNCTION(BlueprintCallable, Category = "Save")
	bool SaveGame();

	/** Debounced, background save. Preferred during play (won't hitch 90fps). */
	UFUNCTION(BlueprintCallable, Category = "Save")
	void SaveGameAsync();

	/** Load into memory. Falls back to backup, then defaults. */
	UFUNCTION(BlueprintCallable, Category = "Save")
	bool LoadGame();

	UFUNCTION(BlueprintCallable, Category = "Save")
	bool HasSaveData() const;

	UFUNCTION(BlueprintCallable, Category = "Save")
	void DeleteSaveData();

	/** Add an area to the visited list (deduped) and schedule a save. */
	UFUNCTION(BlueprintCallable, Category = "Save")
	void MarkAreaVisited(const FString& Area);

	/** Record a viewed hotspot (deduped) and schedule a save. */
	UFUNCTION(BlueprintCallable, Category = "Save")
	void MarkHotspotViewed(const FString& HotspotId);

	UFUNCTION(BlueprintCallable, Category = "Save")
	FCampusSaveData GetData() const { return Current; }

	/** Update the resume transform (does not auto-save; caller decides when). */
	UFUNCTION(BlueprintCallable, Category = "Save")
	void SetPlayerTransform(FVector Location, FRotator Rotation);

	/** Persist the anonymous session/user id (writes immediately). */
	UFUNCTION(BlueprintCallable, Category = "Save")
	void SetSessionId(const FString& InSessionId);

	UFUNCTION(BlueprintCallable, Category = "Save")
	FString GetSessionId() const { return Current.SessionId; }

	// ---- Static IO helpers (pure; unit-testable without a game instance) ---
	static FString ToJson(const FCampusSaveData& Data);
	static bool    FromJson(const FString& Json, FCampusSaveData& OutData);
	static bool    SaveToFile(const FString& FilePath, const FCampusSaveData& Data);
	static bool    LoadFromFile(const FString& FilePath, FCampusSaveData& OutData);

	/** Saved/SaveGames/campus_session.json */
	static FString DefaultSlotPath();

private:
	FCampusSaveData Current;

	bool  bDirty = false;
	float DebounceSeconds = 2.0f;
	FTSTicker::FDelegateHandle FlushHandle;

	void ScheduleFlush();
	bool FlushTick(float DeltaTime);   // FTSTicker callback
	void FlushNow();                   // writes if dirty (async)

	static FCampusSaveData Migrate(FCampusSaveData In);
};
