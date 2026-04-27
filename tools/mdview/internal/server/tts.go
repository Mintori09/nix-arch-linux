package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/mintori/home-manager/tools/mdview/internal/config"
)

const googleTTSAPIURL = "https://texttospeech.googleapis.com/v1/text:synthesize"

type TTSService interface {
	Synthesize(context.Context, SynthesizeRequest) (SynthesizeResponse, error)
}

type SynthesizeRequest struct {
	Text     string
	Provider string
	Language string
	Voice    string
	Speed    float64
}

type SynthesizeResponse struct {
	AudioContentBase64 string
	AudioEncoding      string
	ContentType        string
	VoiceName          string
}

type GoogleTTSService struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewTTSService(cfg config.Config) TTSService {
	if strings.EqualFold(cfg.TTSProvider, "google") {
		return &GoogleTTSService{
			APIKey:     os.Getenv("MDVIEW_GOOGLE_TTS_API_KEY"),
			HTTPClient: http.DefaultClient,
		}
	}
	return &GoogleTTSService{
		APIKey:     os.Getenv("MDVIEW_GOOGLE_TTS_API_KEY"),
		HTTPClient: http.DefaultClient,
	}
}

func (s *GoogleTTSService) Synthesize(ctx context.Context, req SynthesizeRequest) (SynthesizeResponse, error) {
	if strings.TrimSpace(req.Text) == "" {
		return SynthesizeResponse{}, errors.New("text is required")
	}
	if strings.TrimSpace(s.APIKey) == "" {
		return SynthesizeResponse{}, errors.New("missing MDVIEW_GOOGLE_TTS_API_KEY")
	}

	payload := map[string]any{
		"input": map[string]string{
			"text": req.Text,
		},
		"voice": map[string]string{
			"languageCode": req.Language,
			"name":         req.Voice,
		},
		"audioConfig": map[string]any{
			"audioEncoding": "MP3",
			"speakingRate":  req.Speed,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("encode google tts request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTTSAPIURL+"?key="+s.APIKey, bytes.NewReader(body))
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("build google tts request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := s.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("google tts request failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return SynthesizeResponse{}, fmt.Errorf("read google tts response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return SynthesizeResponse{}, fmt.Errorf("google tts error: %s", strings.TrimSpace(string(data)))
	}

	var parsed struct {
		AudioContent string `json:"audioContent"`
	}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return SynthesizeResponse{}, fmt.Errorf("decode google tts response: %w", err)
	}

	return SynthesizeResponse{
		AudioContentBase64: parsed.AudioContent,
		AudioEncoding:      "MP3",
		ContentType:        "audio/mpeg",
		VoiceName:          req.Voice,
	}, nil
}

type TTSVoice struct {
	Name     string `json:"name"`
	Label    string `json:"label"`
	Language string `json:"language"`
	Gender   string `json:"gender"`
	Tier     string `json:"tier"`
}

func googleVoicesForLanguage(language string) []TTSVoice {
	switch language {
	case "vi-VN":
		return []TTSVoice{
			{Name: "vi-VN-Wavenet-A", Label: "Wavenet A", Language: "vi-VN", Gender: "female", Tier: "premium"},
			{Name: "vi-VN-Wavenet-B", Label: "Wavenet B", Language: "vi-VN", Gender: "male", Tier: "premium"},
			{Name: "vi-VN-Wavenet-C", Label: "Wavenet C", Language: "vi-VN", Gender: "female", Tier: "premium"},
			{Name: "vi-VN-Wavenet-D", Label: "Wavenet D", Language: "vi-VN", Gender: "male", Tier: "premium"},
			{Name: "vi-VN-Neural2-A", Label: "Neural2 A", Language: "vi-VN", Gender: "female", Tier: "premium"},
			{Name: "vi-VN-Neural2-D", Label: "Neural2 D", Language: "vi-VN", Gender: "male", Tier: "premium"},
			{Name: "vi-VN-Standard-A", Label: "Standard A", Language: "vi-VN", Gender: "female", Tier: "standard"},
			{Name: "vi-VN-Standard-B", Label: "Standard B", Language: "vi-VN", Gender: "male", Tier: "standard"},
			{Name: "vi-VN-Standard-C", Label: "Standard C", Language: "vi-VN", Gender: "female", Tier: "standard"},
			{Name: "vi-VN-Standard-D", Label: "Standard D", Language: "vi-VN", Gender: "male", Tier: "standard"},
		}
	case "en-US":
		return []TTSVoice{
			{Name: "en-US-Wavenet-F", Label: "Wavenet F", Language: "en-US", Gender: "female", Tier: "premium"},
			{Name: "en-US-Wavenet-D", Label: "Wavenet D", Language: "en-US", Gender: "male", Tier: "premium"},
			{Name: "en-US-Standard-H", Label: "Standard H", Language: "en-US", Gender: "female", Tier: "standard"},
			{Name: "en-US-Standard-I", Label: "Standard I", Language: "en-US", Gender: "male", Tier: "standard"},
		}
	default:
		return nil
	}
}
