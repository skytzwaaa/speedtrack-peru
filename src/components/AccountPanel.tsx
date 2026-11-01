import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { authRedirect, supabase } from "../services/supabase";
import { useI18n } from "../i18n";
import { authError } from "../services/authErrors";
export function AccountPanel({
  active,
  importLocal,
}: {
  active: boolean;
  importLocal: () => void;
}) {
  const { user, recovery, recovered, setNotice } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register" | "resetPassword">(
    "login",
  );
  const [name, setName] = useState(user?.user_metadata.name ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function showError(error: unknown) {
    const detail = authError(error);
    console.warn("SpeedTrack Auth", detail.code, detail.status ?? 0);
    setMessage(
      `${t(detail.key)} ${t("authReference", { code: detail.code, status: detail.status ?? "—" })}`,
    );
  }
  useEffect(() => {
    if (!user || !supabase) return;
    let live = true;
    void supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (live && data) setName(data.name);
      });
    return () => {
      live = false;
    };
  }, [user]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    setNotice(null);
    try {
      let error;
      if (recovery) ({ error } = await supabase.auth.updateUser({ password }));
      else if (user) {
        ({ error } = await supabase
          .from("profiles")
          .upsert({ id: user.id, name: name.trim() }));
        if (!error)
          ({ error } = await supabase.auth.updateUser({
            data: { name: name.trim() },
          }));
      } else if (mode === "register")
        ({ error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: authRedirect,
          },
        }));
      else if (mode === "resetPassword")
        ({ error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirect,
        }));
      else
        ({ error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }));
      if (error) throw error;
      setPassword("");
      setMessage(
        t(
          user
            ? "saved"
            : mode === "register"
              ? "authSignupSent"
              : "authRecoverySent",
        ),
      );
      if (recovery) {
        recovered();
        const result = await supabase.auth.signOut({ scope: "local" });
        if (result.error) throw result.error;
        setNotice("authPasswordUpdated");
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }
  if (!supabase) return <p className="notice">{t("cloudSetup")}</p>;
  return (
    <section className="card setup-card account-panel">
      <h2>{t(recovery ? "newPassword" : user ? "account" : mode)}</h2>
      <p className="muted">{user?.email || t("privacyInfo")}</p>
      {active && <p className="notice">{t("finishBeforeAccount")}</p>}
      <form onSubmit={submit}>
        {!recovery && (user || mode === "register") && (
          <label>
            {t("name")}
            <input
              required
              maxLength={80}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {!user && (
          <label>
            {t("email")}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {(recovery || (!user && mode !== "resetPassword")) && (
          <label>
            {t("password")}
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "login" && !recovery
                  ? "current-password"
                  : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button className="primary-button" disabled={busy || active}>
          {t(user ? (recovery ? "newPassword" : "saveProfile") : mode)}
        </button>
      </form>
      <p role="status" className="muted">
        {message}
      </p>
      {!user ? (
        <div className="account-actions">
          {(["login", "register", "resetPassword"] as const)
            .filter((x) => x !== mode)
            .map((x) => (
              <button
                className="text-button"
                key={x}
                disabled={busy || active}
                onClick={() => {
                  setMode(x);
                  setMessage("");
                }}
              >
                {t(x)}
              </button>
            ))}
        </div>
      ) : (
        <>
          <button
            className="secondary-button full"
            disabled={active || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await importLocal();
              } catch (error) {
                showError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("importLocal")}
          </button>
          <p className="muted">{t("importInfo")}</p>
          <button
            className="secondary-button full"
            disabled={active || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { error } = await supabase!.auth.signOut({
                  scope: "local",
                });
                if (error) throw error;
              } catch (error) {
                showError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("logout")}
          </button>
        </>
      )}
    </section>
  );
}
