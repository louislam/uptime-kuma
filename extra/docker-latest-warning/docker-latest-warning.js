// Injected into the legacy `latest` / `1` Docker images.
(() => {
    const isSetupPage = () => location.pathname === "/setup" || location.pathname.startsWith("/setup/");

    let acknowledged = false;
    let overlay = null;
    let styleAdded = false;

    const show = () => {
        if (acknowledged || overlay || !isSetupPage()) {
            return;
        }

        if (!styleAdded) {
            const style = document.createElement("style");
            style.textContent = ".uk-latest-warning { position: fixed; inset: 0; z-index: 2147483647; }";
            document.documentElement.appendChild(style);
            styleAdded = true;
        }

        overlay = document.createElement("div");
        overlay.className =
            "uk-latest-warning d-flex align-items-center justify-content-center p-3 bg-dark text-white overflow-auto";
        overlay.innerHTML = `
            <div style="max-width: 640px;">
                <h3 class="mb-3">⚠️ This Uptime Kuma version is outdated!</h3>
                <p>
                    Current Version: 1.23.17 (Outdated!)
                </p>
                <p>
                    You are running the <code>latest</code> tag, which still points to Uptime Kuma v1.
                    It is NO LONGER maintained and does not receive any bug or security fixes.
                </p>
                <p>
                    Please switch to a recommended tag, to get the latest version and security updates.
                </p>
                <p class="mb-4">
                    Read more:
                    <a class="link-light" href="https://github.com/louislam/uptime-kuma/wiki/Docker-Tags" target="_blank" rel="noopener noreferrer">Recommended Docker Tags</a>
                </p>
                <button type="button" class="btn btn-danger">Ignore and continue with the old version</button>
            </div>
        `;

        overlay.querySelector("button").addEventListener("click", () => {
            acknowledged = true;
            overlay.remove();
            overlay = null;
        });

        document.documentElement.appendChild(overlay);
    };

    // The app redirects to /setup with the client-side router, so watch for route changes.
    for (const method of ["pushState", "replaceState"]) {
        const original = history[method];
        history[method] = function () {
            const result = original.apply(history, arguments);
            show();
            return result;
        };
    }

    window.addEventListener("popstate", show);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", show);
    } else {
        show();
    }
})();
