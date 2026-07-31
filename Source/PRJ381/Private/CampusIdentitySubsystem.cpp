// CampusIdentitySubsystem.cpp

#include "CampusIdentitySubsystem.h"
#include "CampusSaveManager.h" // adjust to your layout, e.g. "Save/CampusSaveManager.h"

#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/ConfigCacheIni.h"
#include "Misc/Guid.h"
#include "Engine/GameInstance.h"

void UCampusIdentitySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	if (GConfig)
	{
		GConfig->GetString(TEXT("Firebase"), TEXT("ApiKey"), ApiKey, GGameIni);
		GConfig->GetBool(TEXT("Firebase"), TEXT("UseFirebase"), bUseFirebase, GGameIni);
	}
}

UCampusSaveManager* UCampusIdentitySubsystem::GetSave() const
{
	if (const UGameInstance* GI = GetGameInstance())
	{
		return GI->GetSubsystem<UCampusSaveManager>();
	}
	return nullptr;
}

void UCampusIdentitySubsystem::BeginSession()
{
	// 1) Reuse a persisted id if present (returning visitor on this device).
	if (const UCampusSaveManager* Save = GetSave())
	{
		const FString Existing = Save->GetSessionId();
		if (!Existing.IsEmpty())
		{
			FinishWith(Existing, TEXT(""), /*bPersistNew*/ false);
			return;
		}
	}

	// 2) Fresh session: try Firebase, else fall back to a local id.
	if (bUseFirebase && !ApiKey.IsEmpty())
	{
		SignInAnonymously();
	}
	else
	{
		FallbackToLocalId();
	}
}

void UCampusIdentitySubsystem::SignInAnonymously()
{
	const FString Url = FString::Printf(
		TEXT("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=%s"), *ApiKey);

	const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Url);
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetContentAsString(TEXT("{\"returnSecureToken\":true}"));

	TWeakObjectPtr<UCampusIdentitySubsystem> WeakThis(this);
	Request->OnProcessRequestComplete().BindLambda(
		[WeakThis](FHttpRequestPtr Req, FHttpResponsePtr Resp, bool bConnectedSuccessfully)
		{
			if (!WeakThis.IsValid())
			{
				return;
			}
			UCampusIdentitySubsystem* Self = WeakThis.Get();

			if (bConnectedSuccessfully && Resp.IsValid() && Resp->GetResponseCode() == 200)
			{
				TSharedPtr<FJsonObject> Json;
				const TSharedRef<TJsonReader<>> Reader =
					TJsonReaderFactory<>::Create(Resp->GetContentAsString());
				if (FJsonSerializer::Deserialize(Reader, Json) && Json.IsValid())
				{
					FString LocalId, Token;
					Json->TryGetStringField(TEXT("localId"), LocalId);
					Json->TryGetStringField(TEXT("idToken"), Token);
					if (!LocalId.IsEmpty())
					{
						Self->FinishWith(LocalId, Token, /*bPersistNew*/ true);
						return;
					}
				}
			}

			UE_LOG(LogTemp, Warning,
				TEXT("Firebase anonymous sign-in failed (code %d); using a local id."),
				(Resp.IsValid() ? Resp->GetResponseCode() : 0));
			Self->FallbackToLocalId();
		});

	Request->ProcessRequest();
}

void UCampusIdentitySubsystem::FallbackToLocalId()
{
	const FString LocalId = TEXT("local-") +
		FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens);
	FinishWith(LocalId, TEXT(""), /*bPersistNew*/ true);
}

void UCampusIdentitySubsystem::FinishWith(const FString& InSessionId,
	const FString& InIdToken, bool bPersistNew)
{
	SessionId = InSessionId;
	IdToken = InIdToken;
	bReady = true;

	if (bPersistNew)
	{
		if (UCampusSaveManager* Save = GetSave())
		{
			Save->SetSessionId(SessionId);
		}
	}

	OnSessionReady.Broadcast(SessionId);
}
