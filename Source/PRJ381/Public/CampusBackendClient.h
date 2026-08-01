// CampusBackendClient.h
// Sends leads + analytics events to the Node/Express backend over HTTP.
// Uses Unreal's built-in HTTP + Json modules (no third-party plugin required).
//
// Base URL resolves from DefaultGame.ini:
//   [CampusBackend]
//   BaseUrl=http://localhost:4000
// ...falling back to http://localhost:4000 if unset. Override at runtime with
// SetBaseUrl().

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "CampusBackendClient.generated.h"

// Broadcast when a request completes. bSuccess = HTTP 2xx.
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(
	FOnBackendResult, bool, bSuccess, int32, StatusCode, const FString&, Message);

UCLASS()
class UCampusBackendClient : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Bind in Blueprint to react to a lead submission result. */
	UPROPERTY(BlueprintAssignable, Category = "Backend")
	FOnBackendResult OnLeadResult;

	/** Bind in Blueprint to react to an analytics event result. */
	UPROPERTY(BlueprintAssignable, Category = "Backend")
	FOnBackendResult OnEventResult;

	UFUNCTION(BlueprintCallable, Category = "Backend")
	void SetBaseUrl(const FString& InBaseUrl);

	UFUNCTION(BlueprintCallable, Category = "Backend")
	FString GetBaseUrl() const { return BaseUrl; }

	/** POST /api/leads — Request More Information. Email required. */
	UFUNCTION(BlueprintCallable, Category = "Backend")
	void SubmitLead(const FString& Email, const FString& HotspotId, const FString& SessionId);

	/**
	 * POST /api/analytics/events — one engagement event.
	 * EventType must be one of:
	 *   session_start, session_end, area_enter, area_exit, hotspot_view, info_request
	 */
	UFUNCTION(BlueprintCallable, Category = "Backend")
	void SendEvent(const FString& SessionId, const FString& EventType,
		const FString& Area, const FString& HotspotId, int32 DurationMs);

private:
	FString BaseUrl = TEXT("http://localhost:4000");

	// Monotonic per-session counter so events can be ordered deterministically
	// even when two land in the same millisecond (e.g. area_exit + area_enter).
	int32 EventSeq = 0;

	void PostJson(const FString& Endpoint, const FString& JsonBody, FOnBackendResult* ResultDelegate);
};
