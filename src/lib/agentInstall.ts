/** Print Agent installer: one place to bump the version on a new release. */
export const AGENT_VERSION = "1.0.12";
export const AGENT_REPO = "https://github.com/Kuldeepsinghrajpoot/QR-printer-agent";
export const AGENT_DOWNLOAD_URL = `${AGENT_REPO}/releases/download/v${AGENT_VERSION}/QRtoPrint-Setup-${AGENT_VERSION}.exe`;
export const AGENT_RELEASES_URL = `${AGENT_REPO}/releases`;

export type Bilingual = { en: string; hi: string };

export type InstallStep = {
  /** file in /public/install (replace it with a real screenshot of the same name to update the guide) */
  image: string;
  title: Bilingual;
  body: Bilingual;
  /** "pc" = on the shop PC, "dash" = in this dashboard */
  where: "pc" | "dash";
};

export const REQUIREMENTS: Bilingual[] = [
  { en: "Windows 10 or 11 PC", hi: "Windows 10 या 11 वाला PC" },
  { en: "Internet connection", hi: "इंटरनेट कनेक्शन" },
  { en: "Printer already installed in Windows", hi: "प्रिंटर Windows में पहले से इंस्टॉल हो" },
];

export const INSTALL_STEPS: InstallStep[] = [

  {
    image: "2-open-file",
    where: "pc",
    title: { en: "Open the downloaded file", hi: "डाउनलोड की गई फ़ाइल खोलें" },
    body: {
      en: "Can't find it? Open the Downloads folder and double-click QRtoPrint-Setup-" + AGENT_VERSION + ".exe.",
      hi: "फ़ाइल न मिले तो Downloads फ़ोल्डर खोलें और QRtoPrint-Setup-" + AGENT_VERSION + ".exe पर डबल-क्लिक करें।",
    },
  },
  {
    image: "3-more-info",
    where: "pc",
    title: { en: "Windows warning: click “More info”", hi: "Windows की चेतावनी: “More info” दबाएँ" },
    body: {
      en: "A blue “Windows protected your PC” screen may appear. This is normal for a new app. Click “More info”.",
      hi: "नीली “Windows protected your PC” स्क्रीन आ सकती है। नई ऐप के लिए यह सामान्य है। “More info” पर क्लिक करें।",
    },
  },
  {
    image: "4-run-anyway",
    where: "pc",
    title: { en: "Click “Run anyway”", hi: "“Run anyway” पर क्लिक करें" },
    body: {
      en: "A new button “Run anyway” appears. Click it to start the installer.",
      hi: "नीचे “Run anyway” बटन दिखेगा। इंस्टॉलर शुरू करने के लिए उस पर क्लिक करें।",
    },
  },
  {
    image: "5-install",
    where: "pc",
    title: { en: "Click “Install”", hi: "“Install” पर क्लिक करें" },
    body: {
      en: "Keep the folder as it is (the default is fine) and click “Install”.",
      hi: "फ़ोल्डर जैसा है वैसा ही रहने दें (डिफ़ॉल्ट ठीक है) और “Install” पर क्लिक करें।",
    },
  },
  {
    image: "6-installing",
    where: "pc",
    title: { en: "Wait for it to finish", hi: "पूरा होने तक रुकें" },
    body: {
      en: "Wait 1–2 minutes. The app opens by itself, and a QRtoPrint icon is added to your Desktop and Start menu.",
      hi: "1–2 मिनट रुकें। ऐप अपने आप खुल जाएगी और Desktop व Start menu में QRtoPrint आइकन बन जाएगा।",
    },
  },
  {
    image: "7-create-key",
    where: "dash",
    title: { en: "Create your agent key in the dashboard", hi: "डैशबोर्ड में अपनी Agent Key बनाएँ" },
    body: {
      en: "In this dashboard open Settings → Print Agent → “Create agent key”, then press Copy. The key is shown only once.",
      hi: "इसी डैशबोर्ड में Settings → Print Agent → “Create agent key” खोलें, फिर Copy दबाएँ। Key सिर्फ़ एक बार दिखती है।",
    },
  },
  {
    image: "8-paste-key",
    where: "pc",
    title: { en: "Paste the key in the app", hi: "ऐप में Key पेस्ट करें" },
    body: {
      en: "Open the QRtoPrint app → Print Agent tab → paste the key under “Agent API key” → click “Add key”.",
      hi: "QRtoPrint ऐप खोलें → Print Agent टैब → “Agent API key” में key पेस्ट करें → “Add key” दबाएँ।",
    },
  },
  {
    image: "9-connected",
    where: "pc",
    title: { en: "Connected! Turn on auto-start", hi: "जुड़ गया! Auto-start चालू करें" },
    body: {
      en: "A green dot and “Linked to dashboard” mean it works. Tick “Start automatically when this PC turns on” and click “Save & restart agent”. Install on ONE PC only.",
      hi: "हरा डॉट और “Linked to dashboard” दिखे तो सब ठीक है। “Start automatically when this PC turns on” टिक करें और “Save & restart agent” दबाएँ। सिर्फ़ एक ही PC पर इंस्टॉल करें।",
    },
  },
];
