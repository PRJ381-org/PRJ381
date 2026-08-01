// HotspotActor.cpp

#include "HotspotActor.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/World.h"
#include "Engine/GameInstance.h"

#include "CampusBackendClient.h"
#include "CampusIdentitySubsystem.h"
#include "CampusSaveManager.h"

AHotspotActor::AHotspotActor()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	RootComponent = Mesh;

	// Only block the Visibility channel so a camera/controller line trace can
	// hit it — but don't obstruct the player's movement.
	Mesh->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Mesh->SetCollisionResponseToAllChannels(ECR_Ignore);
	Mesh->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
}

void AHotspotActor::Interact()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	// Cooldown: ignore rapid repeats so analytics stays clean (M1 requirement).
	const float Now = World->GetTimeSeconds();
	if (Now - LastInteractTime < InteractCooldownSeconds)
	{
		return;
	}
	LastInteractTime = Now;

	UGameInstance* GI = World->GetGameInstance();
	if (!GI)
	{
		return;
	}

	FString SessionId;
	if (UCampusIdentitySubsystem* Identity = GI->GetSubsystem<UCampusIdentitySubsystem>())
	{
		SessionId = Identity->GetSessionId();
	}

	if (UCampusSaveManager* Save = GI->GetSubsystem<UCampusSaveManager>())
	{
		Save->MarkHotspotViewed(HotspotId);
	}

	if (UCampusBackendClient* Backend = GI->GetSubsystem<UCampusBackendClient>())
	{
		Backend->SendEvent(SessionId, TEXT("hotspot_view"), Area, HotspotId, 0);
	}

	UE_LOG(LogTemp, Log, TEXT("Hotspot '%s' (%s) interacted; session=%s"),
		*HotspotId, *Area, *SessionId);

	OnInteracted(); // let a Blueprint child open the overlay, etc.
}
