-- Uptime Kuma tag taxonomy and monitor assignments
-- Target: news_status (MariaDB)
-- Idempotent: re-running will not duplicate tags or monitor_tag rows.
--
-- Created: 25/05/2026
-- Author : master3395
--
-- Tags use four orthogonal dimensions:
--   1. Environment (prod / staging / dev)
--   2. Service type (web / api / worker / webhook / db / mail / dns / ssl / cdn)
--   3. Project / domain (newstargeted.com, mas, api.newstargeted.com,
--      status, infoskjerm, discord, roblox, analytics, nightscout, pm2)
--   4. Priority (critical / high / medium / low)

START TRANSACTION;

-- =========================================================================
-- 1. TAGS
-- =========================================================================
INSERT INTO tag (name, color) SELECT 'prod',                  '#dc3545' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='prod');
INSERT INTO tag (name, color) SELECT 'staging',               '#fd7e14' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='staging');
INSERT INTO tag (name, color) SELECT 'dev',                   '#6c757d' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='dev');

INSERT INTO tag (name, color) SELECT 'web',                   '#0d6efd' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='web');
INSERT INTO tag (name, color) SELECT 'api',                   '#20c997' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='api');
INSERT INTO tag (name, color) SELECT 'worker',                '#ffc107' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='worker');
INSERT INTO tag (name, color) SELECT 'webhook',               '#e83e8c' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='webhook');
INSERT INTO tag (name, color) SELECT 'db',                    '#6610f2' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='db');
INSERT INTO tag (name, color) SELECT 'mail',                  '#8e44ad' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='mail');
INSERT INTO tag (name, color) SELECT 'dns',                   '#198754' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='dns');
INSERT INTO tag (name, color) SELECT 'ssl',                   '#0dcaf0' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='ssl');
INSERT INTO tag (name, color) SELECT 'cdn',                   '#5bc0de' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='cdn');

INSERT INTO tag (name, color) SELECT 'newstargeted.com',      '#0d3b66' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='newstargeted.com');
INSERT INTO tag (name, color) SELECT 'mas',                   '#1f7a8c' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='mas');
INSERT INTO tag (name, color) SELECT 'api.newstargeted.com',  '#1d3557' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='api.newstargeted.com');
INSERT INTO tag (name, color) SELECT 'status',                '#264653' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='status');
INSERT INTO tag (name, color) SELECT 'infoskjerm',            '#0a9396' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='infoskjerm');
INSERT INTO tag (name, color) SELECT 'discord',               '#5865f2' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='discord');
INSERT INTO tag (name, color) SELECT 'roblox',                '#e2231a' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='roblox');
INSERT INTO tag (name, color) SELECT 'analytics',             '#9c27b0' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='analytics');
INSERT INTO tag (name, color) SELECT 'nightscout',            '#00bcd4' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='nightscout');
INSERT INTO tag (name, color) SELECT 'pm2',                   '#2b794d' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='pm2');
INSERT INTO tag (name, color) SELECT 'rabbitmq',              '#ff6600' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='rabbitmq');
INSERT INTO tag (name, color) SELECT 'cursor',                '#7e57c2' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='cursor');

INSERT INTO tag (name, color) SELECT 'critical',              '#b30000' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='critical');
INSERT INTO tag (name, color) SELECT 'high',                  '#e63946' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='high');
INSERT INTO tag (name, color) SELECT 'medium',                '#f4a261' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='medium');
INSERT INTO tag (name, color) SELECT 'low',                   '#adb5bd' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM tag WHERE name='low');

-- =========================================================================
-- 2. MONITOR <-> TAG ASSIGNMENTS
-- =========================================================================

-- Every active monitor in this instance is production
INSERT INTO monitor_tag (monitor_id, tag_id, value)
SELECT m.id, t.id, ''
  FROM monitor m, tag t
 WHERE t.name = 'prod'
   AND m.active = 1
   AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id = m.id AND x.tag_id = t.id);

-- ---- HTTP monitors --------------------------------------------------------
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Analytics API'          AND t.name IN ('api','analytics','high')               AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Convert API'            AND t.name IN ('api','high')                            AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='DBM API'                AND t.name IN ('api','discord','high')                  AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Discord API'            AND t.name IN ('api','discord','high')                  AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Infoskjerm API'         AND t.name IN ('api','infoskjerm','high')               AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='MAS API'                AND t.name IN ('api','mas','high')                      AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='RBX-Tracker / RBX Stats' AND t.name IN ('api','roblox','high')                  AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Roblox API'             AND t.name IN ('api','roblox','medium')                 AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Webhook API'            AND t.name IN ('api','webhook','critical')              AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Diabetes / Nightscout'  AND t.name IN ('web','nightscout','medium')             AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='MAS'                    AND t.name IN ('web','mas','high')                      AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='Raw Data'               AND t.name IN ('api','high')                            AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='HTTP Webhook Public'    AND t.name IN ('api','webhook','critical')              AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='HTTP Webhook Internal'  AND t.name IN ('api','webhook','critical')              AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='HTTP NT Main Internal'  AND t.name IN ('api','newstargeted.com','critical')     AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='HTTP NT Pro Internal'   AND t.name IN ('api','newstargeted.com','critical')     AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);

-- ---- PM2 push monitors ----------------------------------------------------
-- All PM2 push monitors get worker + pm2.
INSERT INTO monitor_tag (monitor_id, tag_id, value)
SELECT m.id, t.id, ''
  FROM monitor m, tag t
 WHERE m.name LIKE 'PM2 %'
   AND t.name IN ('worker','pm2')
   AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id = m.id AND x.tag_id = t.id);

-- Individual PM2 worker priorities and extra context tags
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 connection-watchdog'         AND t.name IN ('high')                       AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 consumer-safety-watchdog'    AND t.name IN ('high','rabbitmq')            AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 cpu-monitor'                 AND t.name IN ('medium')                     AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 cursor-status-monitor'       AND t.name IN ('low','cursor')               AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 devforum-news-monitor'       AND t.name IN ('medium','roblox')            AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 discord-status-monitor'      AND t.name IN ('low','discord')              AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 enhanced-webhook-proxy'      AND t.name IN ('high','webhook')             AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 extraction-rpg'              AND t.name IN ('medium','roblox')            AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 HD-Admin'                    AND t.name IN ('high','roblox')              AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 nt-canary'                   AND t.name IN ('low','newstargeted.com')     AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 nt-canary2'                  AND t.name IN ('low','newstargeted.com')     AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 nt-main'                     AND t.name IN ('critical','newstargeted.com') AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 nt-pro'                      AND t.name IN ('critical','newstargeted.com') AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 nt-rawdata'                  AND t.name IN ('high','newstargeted.com')    AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 pm2-log-to-db'               AND t.name IN ('medium','db')                AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 rabbitmq-connection-cleanup' AND t.name IN ('medium','rabbitmq')          AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 rabbitmq-watchdog'           AND t.name IN ('high','rabbitmq')            AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 RBX-Tracker'                 AND t.name IN ('high','roblox')              AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 roblox-status-monitor'       AND t.name IN ('low','roblox')               AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 status-uptime-kuma'          AND t.name IN ('medium','status')            AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);

-- All PM2 webhook-worker-1..12 get webhook + high
INSERT INTO monitor_tag (monitor_id, tag_id, value)
SELECT m.id, t.id, ''
  FROM monitor m, tag t
 WHERE m.name REGEXP '^PM2 webhook-worker-[0-9]+$'
   AND t.name IN ('webhook','high')
   AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id = m.id AND x.tag_id = t.id);

-- Orchestrator gets webhook + critical
INSERT INTO monitor_tag (monitor_id, tag_id, value) SELECT m.id, t.id, '' FROM monitor m, tag t WHERE m.name='PM2 webhook-worker-orchestrator' AND t.name IN ('webhook','critical') AND NOT EXISTS (SELECT 1 FROM monitor_tag x WHERE x.monitor_id=m.id AND x.tag_id=t.id);

COMMIT;
