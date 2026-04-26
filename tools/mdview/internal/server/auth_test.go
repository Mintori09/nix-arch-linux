package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequireTokenRejectsMissingToken(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodPut, "/api/document", nil)
	rec := httptest.NewRecorder()

	ok := requireToken("secret", rec, req)
	if ok {
		t.Fatal("expected token validation to fail")
	}

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}

func TestRequireTokenAcceptsMatchingTokenHeader(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodPut, "/api/document", nil)
	req.Header.Set("X-MDView-Token", "secret")
	rec := httptest.NewRecorder()

	ok := requireToken("secret", rec, req)
	if !ok {
		t.Fatal("expected token validation to pass")
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected recorder status to stay %d, got %d", http.StatusOK, rec.Code)
	}
}
