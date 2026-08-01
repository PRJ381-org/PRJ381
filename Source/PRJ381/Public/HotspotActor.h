// HotspotActor.h
// A placeable hotspot. Give it a HotspotId + Area in the editor, drop copies
// around the campus, and call Interact() (from a look-at trace on desktop, or a
// controller trace in VR later). On interact it sends a "hotspot_view" analytics
// event and marks the hotspot viewed locally. No overlay here by design — a
// Blueprint child can implement OnInteracted() to open one.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HotspotActor.generated.h"

UCLASS(Blueprintable)
class AHotspotActor : public AActor
{
	GENERATED_BODY()

public:
	AHotspotActor();

	/** Identifies this hotspot in analytics (e.g. "technolab_pc"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hotspot")
	FString HotspotId;

	/** Campus area this hotspot belongs to (e.g. "TechnoLab"). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hotspot")
	FString Area;

	/** Repeat interactions within this many seconds are ignored (analytics noise). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hotspot")
	float InteractCooldownSeconds = 2.0f;

	/** Trigger the hotspot: sends analytics + marks viewed. Call from your trace. */
	UFUNCTION(BlueprintCallable, Category = "Hotspot")
	void Interact();

	/**
	 * For designers: implement this in a Blueprint child to open an overlay,
	 * play a sound, highlight, etc. Fires right after the analytics event.
	 * (Intentionally empty here — overlay is a separate task.)
	 */
	UFUNCTION(BlueprintImplementableEvent, Category = "Hotspot")
	void OnInteracted();

protected:
	/** Visible/aimable mesh. Assign a mesh (e.g. a sphere marker) per instance. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Hotspot")
	class UStaticMeshComponent* Mesh;

private:
	float LastInteractTime = -1000.0f;
};
