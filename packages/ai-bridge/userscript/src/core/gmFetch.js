function gmFetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      url,
      method: opts.method || "GET",
      headers: opts.headers || {},
      responseType: "json",
      onload(res) {
        let data = res.response;
        if (data === undefined && res.responseText) {
          try {
            data = JSON.parse(res.responseText);
          } catch {
            data = res.responseText;
          }
        }
        resolve({
          ok: res.status >= 200 && res.status < 300,
          status: res.status,
          json: () => Promise.resolve(data),
        });
      },
      onerror(err) {
        reject(new Error(`GM_xmlhttpRequest failed: ${err}`));
      },
    });
  });
}
