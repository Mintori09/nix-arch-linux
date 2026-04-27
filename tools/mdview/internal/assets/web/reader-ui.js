const GOOGLE_VOICES = {
  "vi-VN": [
    {
      name: "vi-VN-Wavenet-A",
      label: "Wavenet A",
      language: "vi-VN",
      gender: "female",
      tier: "premium",
    },
    {
      name: "vi-VN-Wavenet-B",
      label: "Wavenet B",
      language: "vi-VN",
      gender: "male",
      tier: "premium",
    },
    {
      name: "vi-VN-Wavenet-C",
      label: "Wavenet C",
      language: "vi-VN",
      gender: "female",
      tier: "premium",
    },
    {
      name: "vi-VN-Wavenet-D",
      label: "Wavenet D",
      language: "vi-VN",
      gender: "male",
      tier: "premium",
    },
    {
      name: "vi-VN-Neural2-A",
      label: "Neural2 A",
      language: "vi-VN",
      gender: "female",
      tier: "premium",
    },
    {
      name: "vi-VN-Neural2-D",
      label: "Neural2 D",
      language: "vi-VN",
      gender: "male",
      tier: "premium",
    },
    {
      name: "vi-VN-Standard-A",
      label: "Standard A",
      language: "vi-VN",
      gender: "female",
      tier: "standard",
    },
    {
      name: "vi-VN-Standard-B",
      label: "Standard B",
      language: "vi-VN",
      gender: "male",
      tier: "standard",
    },
  ],
  "en-US": [
    {
      name: "en-US-Wavenet-F",
      label: "Wavenet F",
      language: "en-US",
      gender: "female",
      tier: "premium",
    },
    {
      name: "en-US-Wavenet-D",
      label: "Wavenet D",
      language: "en-US",
      gender: "male",
      tier: "premium",
    },
    {
      name: "en-US-Standard-H",
      label: "Standard H",
      language: "en-US",
      gender: "female",
      tier: "standard",
    },
    {
      name: "en-US-Standard-I",
      label: "Standard I",
      language: "en-US",
      gender: "male",
      tier: "standard",
    },
  ],
};

export function getReaderPopupVisibility(playbackState) {
  return (
    playbackState === "loading" ||
    playbackState === "playing" ||
    playbackState === "paused"
  );
}

export function getDefaultSettingsTab() {
  return "theme";
}

export function getGoogleVoicesForLanguage(language) {
  return GOOGLE_VOICES[language] || [];
}

export function getBrowserVoicesForLanguage(language) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  return mapBrowserVoices(voices, language);
}

export function mapBrowserVoices(voices, language) {
  const prefix = language.split("-")[0];
  const matched = voices.filter((v) => v.lang.startsWith(prefix));
  return matched.map((v) => ({
    name: v.name,
    label: v.name,
    language: v.lang,
    gender: "unknown",
    tier: "browser",
  }));
}
