package server

import (
	"net/http"
	"strings"
)

func requireToken(token string, w http.ResponseWriter, r *http.Request) bool {
	if token == "" {
		return true
	}

	requestToken := strings.TrimSpace(r.Header.Get("X-MDView-Token"))
	if requestToken == "" {
		requestToken = strings.TrimSpace(r.URL.Query().Get("token"))
	}

	if requestToken != token {
		http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		return false
	}

	return true
}
