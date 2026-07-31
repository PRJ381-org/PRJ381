// Fill out your copyright notice in the Description page of Project Settings.

using UnrealBuildTool;
using System.Collections.Generic;

public class PRJ381EditorTarget : TargetRules
{
	public PRJ381EditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V7;

		ExtraModuleNames.AddRange( new string[] { "PRJ381" } );
	}
}
