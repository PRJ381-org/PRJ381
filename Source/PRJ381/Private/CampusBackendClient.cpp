// CampusBackendClient.cpp

#include "CampusBackendClient.h"

#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Misc/ConfigCacheIni.h"

void UCampusBackendClient::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	// Prefer a configured URL from DefaultGame.ini if present.
	FString Configured;
	if (GConfig &&
		GConfig->GetString(TEXT("CampusBackend"), TEXT("BaseUrl"), Configured, GGameIni) &&
		!Configured.IsEmpty())
	{
		SetBaseUrl(Configured);
	}
}

void UCampusBackendClient::SetBaseUrl(const FString& InBaseUrl)
{
	BaseUrl = InBaseUrl;
	while (BaseUrl.EndsWith(TEXT("/")))
	{
		BaseUrl.LeftChopInline(1); // no trailing slash
	}
}

static FString SerializeJson(const TSharedRef<FJsonObject>& Obj)
{
	FString Out;
	const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Obj, Writer);
	return Out;
}

void UCampusBackendClient::SubmitLead(const FString& Email, const FString& HotspotId, const FString& SessionId)
{
	const TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
	Obj->SetStringField(TEXT("email"), Email);
	if (!HotspotId.IsEmpty()) Obj->SetStringField(TEXT("hotspotId"), HotspotId);
	if (!SessionId.IsEmpty()) Obj->SetStringField(TEXT("sessionId"), SessionId);

	PostJson(TEXT("/api/leads"), SerializeJson(Obj), &OnLeadResult);
}

void UCampusBackendClient::SendEvent(const FString& SessionId, const FString& EventType,
	const FString& Area, const FString& HotspotId, int32 DurationMs)
{
	const TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
	Obj->SetStringField(TEXT("sessionId"), SessionId);
	Obj->SetStringField(TEXT("eventType"), EventType);
	if (!Area.IsEmpty())     Obj->SetStringField(TEXT("area"), Area);
	if (!HotspotId.IsEmpty())Obj->SetStringField(TEXT("hotspotId"), HotspotId);
	if (DurationMs > 0)      Obj->SetNumberField(TEXT("durationMs"), DurationMs);

	PostJson(TEXT("/api/analytics/events"), SerializeJson(Obj), &OnEventResult);
}

void UCampusBackendClient::PostJson(const FString& Endpoint, const FString& JsonBody,
	FOnBackendResult* ResultDelegate)
{
	const FString Url = BaseUrl + Endpoint;

	const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Url);
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetContentAsString(JsonBody);

	TWeakObjectPtr<UCampusBackendClient> WeakThis(this);
	Request->OnProcessRequestComplete().BindLambda(
		[WeakThis, ResultDelegate](FHttpRequestPtr Req, FHttpResponsePtr Resp, bool bConnectedSuccessfully)
		{
			if (!WeakThis.IsValid())
			{
				return; // subsystem gone; nothing to broadcast to
			}

			const bool bHaveResp = bConnectedSuccessfully && Resp.IsValid();
			const int32 Code = bHaveResp ? Resp->GetResponseCode() : 0;
			const bool bSuccess = bHaveResp && Code >= 200 && Code < 300;
			const FString Message = bHaveResp ? Resp->GetContentAsString()
											  : TEXT("Request failed / no connection");

			if (!bSuccess)
			{
				UE_LOG(LogTemp, Warning, TEXT("Backend POST %s -> %d: %s"),
					*Req->GetURL(), Code, *Message);
			}

			if (ResultDelegate)
			{
				ResultDelegate->Broadcast(bSuccess, Code, Message);
			}
		});

	Request->ProcessRequest();
}
