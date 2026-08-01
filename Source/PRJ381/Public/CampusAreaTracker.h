// CampusAreaTracker.h
// GameInstance subsystem that automatically fires area_enter / area_exit as the
// player travels between levels (each level = one campus area). No per-level
// Blueprint edits needed. Derives the area name from the map name
// ("LVL_TechnoLab" -> "TechnoLab") and includes time-spent on exit.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "CampusAreaTracker.generated.h"

class UWorld;

UCLASS()
class UCampusAreaTracker : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

private:
	// Bound to the identity subsystem; lets us fire the first area_enter as soon
	// as the session id is available (it may not be on the very first map load).
	UFUNCTION()
	void HandleSessionReady(const FString& InSessionId);

	void OnPostLoadMap(UWorld* LoadedWorld);
	void UpdateAreaFromWorld(UWorld* World);
	void SendAreaEvent(const FString& EventType, const FString& Area, int32 DurationMs);
	static FString DeriveArea(UWorld* World);

	FString CurrentArea;
	double  EnterTimeSeconds = 0.0;
	bool    bEnterSent = false;

	FDelegateHandle PostLoadMapHandle;
};
