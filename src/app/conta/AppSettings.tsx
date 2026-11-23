"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { INSTALL_EVENT } from "@/components/ServiceWorker";
import { deletePushSubscription, savePushSubscription, sendTestPush, type SubscriptionJson } from "@/app/push-actions";

type Device = { ios: boolean; android: boolean; standalone: boolean; pushSupported: boolean; canPrompt: boolean };

function readDevice(): Device {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return { ios, android: /Android/.test(ua), standalone, pushSupported, canPrompt: Boolean(window.jornalInstallPrompt) };
}

function snapshot(): string {
  return JSON.stringify(readDevice());
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(INSTALL_EVENT, onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    window.removeEventListener(INSTALL_EVENT, onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const button = "bg-ink px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50";
const ghost = "border-2 border-ink px-4 py-2 text-sm font-bold uppercase disabled:opacity-50";
const note = "border-2 border-ink bg-white p-3 text-sm";

function Install({ device }: { device: Device }) {
  if (device.standalone) return <p className={note}>✅ O jornal já está instalado neste aparelho.</p>;
  if (device.canPrompt) {
    return (
      <button
        className={button}
        onClick={async () => {
          const prompt = window.jornalInstallPrompt;
          if (!prompt) return;
          await prompt.prompt();
          await prompt.userChoice;
          window.jornalInstallPrompt = null;
          window.dispatchEvent(new Event(INSTALL_EVENT));
        }}
      >
        📲 Instalar o jornal
      </button>
    );
  }
  if (device.ios) {
    return (
      <p className={note}>
        No iPhone, abre o jornal no <strong>Safari</strong>, toca em <strong>Partilhar</strong> (o quadrado com a seta para
        cima) e depois em <strong>«Adicionar ao ecrã principal»</strong>.
      </p>
    );
  }
  if (device.android) {
    return (
      <p className={note}>
        No Android, abre o jornal no <strong>Chrome</strong>, toca no menu <strong>⋮</strong> e escolhe{" "}
        <strong>«Instalar app»</strong> (ou «Adicionar ao ecrã principal»).
      </p>
    );
  }
  return (
    <p className={note}>
      No telemóvel, abre esta página e segue as instruções. No computador, o Chrome e o Edge mostram um botão de instalar
      na barra de endereço.
    </p>
  );
}

function Notifications({ device, vapidKey }: { device: Device; vapidKey: string | null }) {
  const [subscription, setSubscription] = useState<PushSubscription | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!device.pushSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscription(sub))
      .catch(() => setSubscription(null));
  }, [device.pushSupported]);

  if (!vapidKey) return <p className={note}>As notificações ainda não estão configuradas no servidor.</p>;
  if (device.ios && !device.standalone) {
    return <p className={note}>No iPhone, as notificações só funcionam depois de instalares o jornal no ecrã principal.</p>;
  }
  if (!device.pushSupported) return <p className={note}>Este browser não suporta notificações.</p>;
  if (subscription === undefined) return <p className="text-sm text-muted">A verificar…</p>;

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Recusaste as notificações. Para as ligar, muda a permissão nas definições do browser.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey!) });
      const ok = await savePushSubscription(sub.toJSON() as SubscriptionJson);
      if (!ok) {
        await sub.unsubscribe();
        setMessage("Não foi possível ligar as notificações.");
        return;
      }
      setSubscription(sub);
      setMessage("Notificações ligadas neste aparelho.");
    } catch {
      setMessage("Não foi possível ligar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!subscription) return;
    setBusy(true);
    await deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe().catch(() => undefined);
    setSubscription(null);
    setMessage("Notificações desligadas neste aparelho.");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const sent = await sendTestPush();
    setMessage(sent > 0 ? "Notificação de teste enviada." : "Não foi possível enviar a notificação de teste.");
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Recebes um aviso quando há posts novos, comentários nos teus posts (ou onde comentaste), decretos, a tua semana
        na escala e movimentos do Tesoureiro na tua conta.
      </p>
      {message && <p className="border-2 border-ink bg-flash p-2 text-sm font-semibold">{message}</p>}
      {subscription ? (
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy} onClick={test}>
            Enviar teste
          </button>
          <button className={ghost} disabled={busy} onClick={disable}>
            Desligar
          </button>
        </div>
      ) : (
        <button className={button} disabled={busy} onClick={enable}>
          🔔 Ligar notificações
        </button>
      )}
    </div>
  );
}

export function AppSettings({ vapidKey }: { vapidKey: string | null }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!raw) return null;
  const device = JSON.parse(raw) as Device;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-black uppercase tracking-wider">Instalar no telemóvel</h3>
        <Install device={device} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-black uppercase tracking-wider">Notificações</h3>
        <Notifications device={device} vapidKey={vapidKey} />
      </div>
    </div>
  );
}
