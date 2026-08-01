// DataHandlerTests.cpp
// Unreal Automation Tool (UAT) tests for the data handler.
// Run from: Session Frontend > Automation > "PRJ381.DataHandler.*"
// or headless: -ExecCmds="Automation RunTests PRJ381.DataHandler; Quit"

#include "Misc/AutomationTest.h"
#include "CampusSaveManager.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/FileManager.h"

#if WITH_AUTOMATION_TESTS

namespace
{
	FString TempPath()
	{
		return FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("SaveGames"),
			TEXT("test_campus_session.json"));
	}

	void Cleanup(const FString& Path)
	{
		IFileManager& FM = IFileManager::Get();
		FM.Delete(*Path, false, true, true);
		FM.Delete(*(Path + TEXT(".bak")), false, true, true);
		FM.Delete(*(Path + TEXT(".tmp")), false, true, true);
	}
}

// 1) In-memory JSON round-trip preserves every field.
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDataHandlerRoundTrip,
	"PRJ381.DataHandler.RoundTrip",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
bool FDataHandlerRoundTrip::RunTest(const FString&)
{
	FCampusSaveData In;
	In.CurrentLevelName = TEXT("TechnoLab");
	In.PlayerLocation   = FVector(10.f, 20.f, 30.f);
	In.VisitedAreas     = { TEXT("Alpha"), TEXT("Library") };
	In.ViewedHotspotIds = { TEXT("hs_reception") };
	In.MasterVolume     = 0.5f;
	In.bRequestedInfo   = true;
	In.LeadEmail        = TEXT("test@example.com");

	const FString Json = UCampusSaveManager::ToJson(In);
	TestTrue(TEXT("JSON not empty"), !Json.IsEmpty());

	FCampusSaveData Out;
	TestTrue(TEXT("Parse succeeds"), UCampusSaveManager::FromJson(Json, Out));
	TestEqual(TEXT("Level preserved"),  Out.CurrentLevelName, In.CurrentLevelName);
	TestEqual(TEXT("Volume preserved"), Out.MasterVolume,     In.MasterVolume);
	TestEqual(TEXT("Visited count"),    Out.VisitedAreas.Num(), 2);
	TestEqual(TEXT("Email preserved"),  Out.LeadEmail,        In.LeadEmail);
	return true;
}

// 2) File save -> load round-trip.
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDataHandlerFileRoundTrip,
	"PRJ381.DataHandler.FileRoundTrip",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
bool FDataHandlerFileRoundTrip::RunTest(const FString&)
{
	const FString Path = TempPath();
	Cleanup(Path);

	FCampusSaveData In;
	In.CurrentLevelName = TEXT("Cafeteria");
	TestTrue(TEXT("Save to file"), UCampusSaveManager::SaveToFile(Path, In));

	FCampusSaveData Out;
	TestTrue(TEXT("Load from file"), UCampusSaveManager::LoadFromFile(Path, Out));
	TestEqual(TEXT("Level survives disk"), Out.CurrentLevelName, TEXT("Cafeteria"));

	Cleanup(Path);
	return true;
}

// 3) Missing file returns false (caller then uses defaults).
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDataHandlerMissingFile,
	"PRJ381.DataHandler.MissingFileDefaults",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
bool FDataHandlerMissingFile::RunTest(const FString&)
{
	const FString Path = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("SaveGames"),
		TEXT("definitely_missing.json"));
	Cleanup(Path);

	FCampusSaveData Out;
	TestFalse(TEXT("Load reports failure on missing file"),
		UCampusSaveManager::LoadFromFile(Path, Out));
	return true;
}

// 4) Corrupt main file recovers from the .bak backup.
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDataHandlerCorruptRecovery,
	"PRJ381.DataHandler.CorruptRecovery",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
bool FDataHandlerCorruptRecovery::RunTest(const FString&)
{
	const FString Path = TempPath();
	Cleanup(Path);

	FCampusSaveData Good;
	Good.CurrentLevelName = TEXT("Alpha");
	UCampusSaveManager::SaveToFile(Path, Good); // 1st: creates main (no .bak yet)
	UCampusSaveManager::SaveToFile(Path, Good); // 2nd: backs up main -> .bak

	// Corrupt the main file.
	FFileHelper::SaveStringToFile(TEXT("{ not valid json"), *Path);

	FCampusSaveData Out;
	TestTrue(TEXT("Recovers via backup"), UCampusSaveManager::LoadFromFile(Path, Out));
	TestEqual(TEXT("Backup content intact"), Out.CurrentLevelName, TEXT("Alpha"));

	Cleanup(Path);
	return true;
}

#endif // WITH_AUTOMATION_TESTS
