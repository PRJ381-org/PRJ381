// CampusSaveData.h
// Serializable local save state for the VR Campus Open Day.
// Stored as JSON text (per the M1 data-storage decision).

#pragma once

#include "CoreMinimal.h"
#include "CampusSaveData.generated.h"

/**
 * All persisted per-user session state. Plain data only (no UObject pointers)
 * so it serialises cleanly to/from JSON via FJsonObjectConverter.
 */
USTRUCT(BlueprintType)
struct FCampusSaveData
{
	GENERATED_BODY()

	/** Bump this when the struct changes; drives migration in the manager. */
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	int32 SchemaVersion = 1;

	// ---- Resume state ------------------------------------------------------
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FVector PlayerLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FRotator PlayerRotation = FRotator::ZeroRotator;

	/** Level/area the user was last in, e.g. "TechnoLab". */
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FString CurrentLevelName;

	// ---- Progress / engagement --------------------------------------------
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	TArray<FString> VisitedAreas;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	TArray<FString> ViewedHotspotIds;

	// ---- Comfort / settings ------------------------------------------------
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	float MasterVolume = 1.0f;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	bool bSnapTurn = true;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	bool bTeleportMove = true;

	// ---- Lead capture (optional, only if user opts in) ---------------------
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	bool bRequestedInfo = false;

	/** Kept local and minimal (POPIA). Sent to the backend only on opt-in. */
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FString LeadEmail;

	// ---- Bookkeeping -------------------------------------------------------
	/** Persistent anonymous id: Firebase UID, or a local GUID fallback. */
	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FString SessionId;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FDateTime LastSaved;
};
