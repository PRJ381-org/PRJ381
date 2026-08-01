// CampusIdentitySubsystem.h
// Resolves an anonymous session/user id for the visit and hands it to the rest
// of the app. Strategy, in order:
//   1. Reuse a persisted id (returning visitor on this device).
//   2. Firebase anonymous sign-in via REST (needs an API key + network).
//   3. Local GUID fallback (offline / no key) so nothing ever blocks.
//
// Config (Config/DefaultGame.ini):
//   [Firebase]
//   ApiKey=YOUR_WEB_API_KEY
//   UseFirebase=True

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "CampusIdentitySubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnSessionReady, const FString&, SessionId);

UCLASS()
class UCampusIdentitySubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Fires once the session id is resolved (persisted / Firebase / local). */
	UPROPERTY(BlueprintAssignable, Category = "Identity")
	FOnSessionReady OnSessionReady;

	/** Call once at startup (e.g. GameMode or the entry level's BeginPlay). */
	UFUNCTION(BlueprintCallable, Category = "Identity")
	void BeginSession();

	UFUNCTION(BlueprintCallable, Category = "Identity")
	FString GetSessionId() const { return SessionId; }

	UFUNCTION(BlueprintCallable, Category = "Identity")
	bool IsReady() const { return bReady; }

	/** Firebase ID token; empty when running on a local/offline id. */
	UFUNCTION(BlueprintCallable, Category = "Identity")
	FString GetIdToken() const { return IdToken; }

private:
	FString ApiKey;
	bool bUseFirebase = true;

	FString SessionId;
	FString IdToken;
	bool bReady = false;
	bool bSessionStartSent = false;

	void SignInAnonymously();
	void FallbackToLocalId();
	void FinishWith(const FString& InSessionId, const FString& InIdToken, bool bPersistNew);

	class UCampusSaveManager* GetSave() const;
};
