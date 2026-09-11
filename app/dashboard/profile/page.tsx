import { redirect } from "next/navigation";
import { supabaseServer } from "@/app/lib/supabase/server";
import {
  ColorTheme,
  isColorTheme,
  isSidebarPosition,
  isThemeMode,
  SidebarPosition,
  ThemeMode,
} from "@/app/lib/preferences";
import { ProfilePreferences } from "./ProfilePreferences";

type ProfileMember = {
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  email: string | null;
  created_at: string | null;
  avatar_url: string | null;
  avatar_position_x: number | null;
  avatar_position_y: number | null;
  theme_mode: ThemeMode | null;
  color_theme: ColorTheme | null;
  sidebar_position: SidebarPosition | null;
};

function getMemberInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined
) {
  const initials = [firstName, lastName]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name))
    .map((name) => Array.from(name)[0] ?? "")
    .join("")
    .toLocaleUpperCase();

  return Array.from(initials).slice(0, 2).join("") || "GM";
}

export default async function ProfilePage() {
  const supabase = await supabaseServer();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select(
      "first_name, last_name, role, status, email, created_at, avatar_url, avatar_position_x, avatar_position_y, theme_mode, color_theme, sidebar_position"
    )
    .eq("auth_user_id", session.user.id)
    .single<ProfileMember>();

  if (!member) redirect("/login");

  const themeMode = isThemeMode(member.theme_mode) ? member.theme_mode : "system";
  const colorTheme = isColorTheme(member.color_theme) ? member.color_theme : "blue";
  const sidebarPosition = isSidebarPosition(member.sidebar_position)
    ? member.sidebar_position
    : "left";
  const avatarPositionX = member.avatar_position_x ?? 50;
  const avatarPositionY = member.avatar_position_y ?? 50;
  const displayName =
    [member.first_name, member.last_name]
      .map((name) => name?.trim())
      .filter((name): name is string => Boolean(name))
      .join(" ") ||
    "GIEFA member";
  const avatarInitials = getMemberInitials(
    member.first_name,
    member.last_name
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-6 text-xl font-semibold text-gray-800 dark:text-white">
          Profile
        </h1>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            {member.avatar_url ? (
              <div
                role="img"
                aria-label={`${displayName} profile photo`}
                className="h-20 w-20 shrink-0 rounded-full border border-gray-200 bg-gray-100 bg-cover bg-center dark:border-gray-700 dark:bg-gray-800"
                style={{
                  backgroundImage: `url(${member.avatar_url})`,
                  backgroundPosition: `${avatarPositionX}% ${avatarPositionY}%`,
                }}
              />
            ) : (
              <div
                role="img"
                aria-label={`${displayName} profile avatar placeholder`}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-brand-50 text-xl font-semibold text-brand-700 dark:border-gray-700 dark:bg-brand-500/15 dark:text-brand-200"
              >
                {avatarInitials}
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {displayName}
              </h2>
              <p className="text-sm capitalize text-gray-500 dark:text-gray-400">
                {member.role.replace("_", " ")}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {member.email}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <ProfileItem label="Role" value={member.role} />
          <ProfileItem label="Status" value={member.status} />
          <ProfileItem
            label="Member Since"
            value={
              member.created_at
                ? new Date(member.created_at).toLocaleDateString()
                : "-"
            }
          />
          <ProfileItem
            label="Theme"
            value={`${themeMode} / ${colorTheme} / ${sidebarPosition}`}
          />
        </div>
      </div>

      <ProfilePreferences
        initialAvatarUrl={member.avatar_url}
        initialMemberName={displayName}
        initialAvatarPositionX={avatarPositionX}
        initialAvatarPositionY={avatarPositionY}
        initialThemeMode={themeMode}
        initialColorTheme={colorTheme}
        initialSidebarPosition={sidebarPosition}
      />
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 font-medium capitalize text-gray-800 dark:text-white">
        {value}
      </p>
    </div>
  );
}
