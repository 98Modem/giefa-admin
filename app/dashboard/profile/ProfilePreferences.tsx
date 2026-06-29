"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { supabaseBrowser } from "@/app/lib/supabase/client";
import {
  colorThemes,
  ColorTheme,
  sidebarPositions,
  SidebarPosition,
  themeModes,
  ThemeMode,
} from "@/app/lib/preferences";
import { saveLocalPreferences } from "@/app/components/theme/ThemeProvider";

type ProfilePreferencesProps = {
  initialAvatarUrl: string | null;
  initialAvatarPositionX: number;
  initialAvatarPositionY: number;
  initialThemeMode: ThemeMode;
  initialColorTheme: ColorTheme;
  initialSidebarPosition: SidebarPosition;
};

export function ProfilePreferences({
  initialAvatarUrl,
  initialAvatarPositionX,
  initialAvatarPositionY,
  initialThemeMode,
  initialColorTheme,
  initialSidebarPosition,
}: ProfilePreferencesProps) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPositionX, setAvatarPositionX] = useState(initialAvatarPositionX);
  const [avatarPositionY, setAvatarPositionY] = useState(initialAvatarPositionY);
  const [themeMode, setThemeMode] = useState(initialThemeMode);
  const [colorTheme, setColorTheme] = useState(initialColorTheme);
  const [sidebarPosition, setSidebarPosition] = useState(
    initialSidebarPosition
  );
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!avatarMenuOpen) return;

    const closeMenu = () => setAvatarMenuOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [avatarMenuOpen]);

  const savePreferences = async (
    nextThemeMode: ThemeMode,
    nextColorTheme: ColorTheme,
    nextSidebarPosition = sidebarPosition
  ) => {
    setSaving(true);
    setStatus("");
    setThemeMode(nextThemeMode);
    setColorTheme(nextColorTheme);
    setSidebarPosition(nextSidebarPosition);
    saveLocalPreferences(nextThemeMode, nextColorTheme, nextSidebarPosition);

    const { error } = await supabaseBrowser.rpc("update_member_preferences_v2", {
      p_avatar_url: null,
      p_avatar_position_x: null,
      p_avatar_position_y: null,
      p_theme_mode: nextThemeMode,
      p_color_theme: nextColorTheme,
      p_sidebar_position: nextSidebarPosition,
    });

    setSaving(false);
    setStatus(error ? error.message : "Preferences saved.");
  };

  const saveAvatarFile = async (file: File) => {
    if (!file) return;

    setStatus("");

    if (!file.type.startsWith("image/")) {
      setStatus("Choose a valid image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatus("Avatar image must be 2 MB or smaller.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser();

    if (!user) {
      setSaving(false);
      setStatus("Session expired. Please sign in again.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${user.id}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabaseBrowser.storage
      .from("member-avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setSaving(false);
      setStatus(uploadError.message);
      return;
    }

    const { data } = supabaseBrowser.storage
      .from("member-avatars")
      .getPublicUrl(filePath);

    const { error: updateError } = await supabaseBrowser.rpc(
      "update_member_preferences_v2",
      {
        p_avatar_url: data.publicUrl,
        p_avatar_position_x: avatarPositionX,
        p_avatar_position_y: avatarPositionY,
        p_theme_mode: null,
        p_color_theme: null,
        p_sidebar_position: null,
      }
    );

    setSaving(false);

    if (updateError) {
      setStatus(updateError.message);
      return;
    }

    setAvatarUrl(data.publicUrl);
    window.dispatchEvent(new CustomEvent("giefa-profile-updated"));
    setStatus("Avatar updated.");
  };

  const saveAvatarPosition = async (nextX: number, nextY: number) => {
    setAvatarPositionX(nextX);
    setAvatarPositionY(nextY);

    const { error } = await supabaseBrowser.rpc("update_member_preferences_v2", {
      p_avatar_url: null,
      p_avatar_position_x: nextX,
      p_avatar_position_y: nextY,
      p_theme_mode: null,
      p_color_theme: null,
      p_sidebar_position: null,
    });

    setStatus(error ? error.message : "Avatar position saved.");
    window.dispatchEvent(new CustomEvent("giefa-profile-updated"));
  };

  const chooseImage = () => {
    setAvatarMenuOpen(false);
    fileInputRef.current?.click();
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await saveAvatarFile(file);
    event.target.value = "";
  };

  const openCamera = async () => {
    setStatus("");
    setAvatarMenuOpen(false);
    setCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
    } catch {
      stopCamera();
      setStatus("Camera access was not allowed or is unavailable.");
    }
  };

  const captureAvatar = async () => {
    const video = videoRef.current;
    if (!video) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    if (!size) {
      setStatus("Camera is still starting. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;

    const context = canvas.getContext("2d");
    if (!context) return;

    const sourceX = (video.videoWidth - size) / 2;
    const sourceY = (video.videoHeight - size) / 2;

    context.drawImage(
      video,
      sourceX,
      sourceY,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );

    if (!blob) {
      setStatus("Could not capture photo.");
      return;
    }

    const file = new File([blob], "camera-avatar.jpg", {
      type: "image/jpeg",
    });

    await saveAvatarFile(file);
    stopCamera();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setAvatarMenuOpen((current) => !current);
              }}
              className="group relative h-20 w-20 overflow-hidden rounded-full border border-gray-200 bg-gray-100 bg-cover bg-center ring-offset-2 transition hover:ring-2 hover:ring-brand-500 dark:border-gray-700 dark:ring-offset-gray-900"
              style={{
                backgroundImage: `url(${avatarUrl || "/user/owner.jpg"})`,
                backgroundPosition: `${avatarPositionX}% ${avatarPositionY}%`,
              }}
              aria-label="Change profile photo"
              aria-expanded={avatarMenuOpen}
            >
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white transition group-hover:bg-black/45">
                <CameraIcon
                  className="h-6 w-6 opacity-0 transition group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </button>

            {avatarMenuOpen && (
              <div
                className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-strong)] p-1 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={chooseImage}
                  disabled={saving}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <PhotoIcon className="h-5 w-5" aria-hidden="true" />
                  Upload image
                </button>
                <button
                  type="button"
                  onClick={openCamera}
                  disabled={saving || cameraOpen}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <CameraIcon className="h-5 w-5" aria-hidden="true" />
                  Use camera
                </button>
              </div>
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Profile photo
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Click the image, upload a file, or take a camera photo.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={uploadAvatar}
          className="sr-only"
          disabled={saving}
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={chooseImage}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <PhotoIcon className="h-5 w-5" aria-hidden="true" />
            Upload image
          </button>

          <button
            type="button"
            onClick={openCamera}
            disabled={saving || cameraOpen}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CameraIcon className="h-5 w-5" aria-hidden="true" />
            Use camera
          </button>
        </div>

        {cameraOpen && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/5">
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-square w-full object-cover"
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
                  Starting camera...
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={captureAvatar}
                disabled={!cameraReady || saving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <VideoCameraIcon className="h-5 w-5" aria-hidden="true" />
                Capture photo
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              Reposition photo
            </p>
            <button
              type="button"
              onClick={() => saveAvatarPosition(50, 50)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/10"
            >
              Center
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">
              Horizontal
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={avatarPositionX}
              onChange={(event) => setAvatarPositionX(Number(event.target.value))}
              onMouseUp={() => saveAvatarPosition(avatarPositionX, avatarPositionY)}
              onTouchEnd={() => saveAvatarPosition(avatarPositionX, avatarPositionY)}
              className="w-full accent-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">
              Vertical
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={avatarPositionY}
              onChange={(event) => setAvatarPositionY(Number(event.target.value))}
              onMouseUp={() => saveAvatarPosition(avatarPositionX, avatarPositionY)}
              onTouchEnd={() => saveAvatarPosition(avatarPositionX, avatarPositionY)}
              className="w-full accent-brand-500"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <CloudArrowUpIcon
            className="h-5 w-5 text-brand-500"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Display preferences
          </h2>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Mode
            </p>
            <div className="grid grid-cols-3 gap-2">
              {themeModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => savePreferences(mode.value, colorTheme)}
                  className={`h-10 rounded-lg border text-sm font-semibold transition ${
                    themeMode === mode.value
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Color theme
            </p>
            <div className="flex flex-wrap gap-2">
              {colorThemes.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => savePreferences(themeMode, theme.value)}
                  className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                    colorTheme === theme.value
                      ? "border-gray-900 bg-gray-50 text-gray-900 dark:border-white dark:bg-gray-800 dark:text-white"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: theme.swatch }}
                  />
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Sidebar placement
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {sidebarPositions.map((position) => (
                <button
                  key={position.value}
                  type="button"
                  onClick={() =>
                    savePreferences(themeMode, colorTheme, position.value)
                  }
                  className={`rounded-lg border p-3 text-left transition ${
                    sidebarPosition === position.value
                      ? "border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {position.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 opacity-80">
                    {position.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {status && (
          <p className="mt-5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <CheckCircleIcon
              className="h-5 w-5 text-brand-500"
              aria-hidden="true"
            />
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
