const jsesc = require("jsesc");
const { escape } = require("html-escaper");

/**
 * Returns a string that represents the javascript that is required to insert the PostHog Analytics script
 * into a webpage.
 * @param {string} apiHost API host to use with the PostHog Analytics script.
 * @param {string} projectToken Project token to use with the PostHog Analytics script.
 * @returns {string} HTML script tags to inject into page
 * @see https://posthog.com/docs/getting-started/install?tab=snippet
 */
function getPostHogAnalyticsScript(apiHost, projectToken) {
    let escapedProjectTokenJS = jsesc(projectToken, { isScriptContext: true });
    let escapedApiHostJS = jsesc(apiHost, { isScriptContext: true });

    if (escapedProjectTokenJS) {
        escapedProjectTokenJS = escapedProjectTokenJS.trim();
    }

    if (escapedApiHostJS) {
        escapedApiHostJS = escapedApiHostJS.trim();
    }

    // Escape the domain url for use in an HTML attribute.
    let escapedApiHostHTMLAttribute = escape(escapedApiHostJS);

    // Escape the project token for use in an HTML attribute.
    let escapedProjectTokenHTMLAttribute = escape(escapedProjectTokenJS);

    return `
        <script>
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init os ds Ie us vs ss ls capture calculateEventProperties register register_once register_for_session unregister unregister_for_session ws getFeatureFlag getFeatureFlagPayload getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty bs ps createPersonProfile setInternalOrTestUser ys es $s opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing cs debug M gs getPageViewId captureTraceFeedback captureTraceMetric Qr".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('${escapedProjectTokenHTMLAttribute}', {
                api_host: '${escapedApiHostHTMLAttribute}',
                defaults: '2026-01-30',
            })
        </script>
    `;
}

module.exports = {
    getPostHogAnalyticsScript,
};
