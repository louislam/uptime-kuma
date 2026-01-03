// Migration to update monitor.game from GameDig v4 to v5 game IDs
// Reference: https://github.com/gamedig/node-gamedig/blob/master/MIGRATE_IDS.md

// Lookup table mapping v4 game IDs to v5 game IDs
const gameDig4to5IdMap = {
    "americasarmypg": "aapg",
    "7d2d": "sdtd",
    "as": "actionsource",
    "ageofchivalry": "aoc",
    "arkse": "ase",
    "arcasimracing": "asr08",
    "arma": "aaa",
    "arma2oa": "a2oa",
    "armacwa": "acwa",
    "armar": "armaresistance",
    "armare": "armareforger",
    "armagetron": "armagetronadvanced",
    "bat1944": "battalion1944",
    "bf1942": "battlefield1942",
    "bfv": "battlefieldvietnam",
    "bf2": "battlefield2",
    "bf2142": "battlefield2142",
    "bfbc2": "bbc2",
    "bf3": "battlefield3",
    "bf4": "battlefield4",
    "bfh": "battlefieldhardline",
    "bd": "basedefense",
    "bs": "bladesymphony",
    "buildandshoot": "bas",
    "cod4": "cod4mw",
    "callofjuarez": "coj",
    "chivalry": "cmw",
    "commandos3": "c3db",
    "cacrenegade": "cacr",
    "contactjack": "contractjack",
    "cs15": "counterstrike15",
    "cs16": "counterstrike16",
    "cs2": "counterstrike2",
    "crossracing": "crce",
    "darkesthour": "dhe4445",
    "daysofwar": "dow",
    "deadlydozenpt": "ddpt",
    "dh2005": "deerhunter2005",
    "dinodday": "ddd",
    "dirttrackracing2": "dtr2",
    "dmc": "deathmatchclassic",
    "dnl": "dal",
    "drakan": "dootf",
    "dys": "dystopia",
    "em": "empiresmod",
    "empyrion": "egs",
    "f12002": "formulaone2002",
    "flashpointresistance": "ofr",
    "fivem": "gta5f",
    "forrest": "theforrest",
    "graw": "tcgraw",
    "graw2": "tcgraw2",
    "giantscitizenkabuto": "gck",
    "ges": "goldeneyesource",
    "gore": "gus",
    "hldm": "hld",
    "hldms": "hlds",
    "hlopfor": "hlof",
    "hl2dm": "hl2d",
    "hidden": "thehidden",
    "had2": "hiddendangerous2",
    "igi2": "i2cs",
    "il2": "il2sturmovik",
    "insurgencymic": "imic",
    "isle": "theisle",
    "jamesbondnightfire": "jb007n",
    "jc2mp": "jc2m",
    "jc3mp": "jc3m",
    "kingpin": "kloc",
    "kisspc": "kpctnc",
    "kspdmp": "kspd",
    "kzmod": "kreedzclimbing",
    "left4dead": "l4d",
    "left4dead2": "l4d2",
    "m2mp": "m2m",
    "mohsh": "mohaas",
    "mohbt": "mohaab",
    "mohab": "moha",
    "moh2010": "moh",
    "mohwf": "mohw",
    "minecraftbe": "mbe",
    "mtavc": "gtavcmta",
    "mtasa": "gtasamta",
    "ns": "naturalselection",
    "ns2": "naturalselection2",
    "nwn": "neverwinternights",
    "nwn2": "neverwinternights2",
    "nolf": "tonolf",
    "nolf2": "nolf2asihw",
    "pvkii": "pvak2",
    "ps": "postscriptum",
    "primalcarnage": "pce",
    "pc": "projectcars",
    "pc2": "projectcars2",
    "prbf2": "prb2",
    "przomboid": "projectzomboid",
    "quake1": "quake",
    "quake3": "q3a",
    "ragdollkungfu": "rdkf",
    "r6": "rainbowsix",
    "r6roguespear": "rs2rs",
    "r6ravenshield": "rs3rs",
    "redorchestraost": "roo4145",
    "redm": "rdr2r",
    "riseofnations": "ron",
    "rs2": "rs2v",
    "samp": "gtasam",
    "saomp": "gtasao",
    "savage2": "s2ats",
    "ss": "serioussam",
    "ss2": "serioussam2",
    "ship": "theship",
    "sinep": "sinepisodes",
    "sonsoftheforest": "sotf",
    "swbf": "swb",
    "swbf2": "swb2",
    "swjk": "swjkja",
    "swjk2": "swjk2jo",
    "takeonhelicopters": "toh",
    "tf2": "teamfortress2",
    "terraria": "terrariatshock",
    "tribes1": "t1s",
    "ut": "unrealtournament",
    "ut2003": "unrealtournament2003",
    "ut2004": "unrealtournament2004",
    "ut3": "unrealtournament3",
    "v8supercar": "v8sc",
    "vcmp": "vcm",
    "vs": "vampireslayer",
    "wheeloftime": "wot",
    "wolfenstein2009": "wolfenstein",
    "wolfensteinet": "wet",
    "wurm": "wurmunlimited",
};

/**
 * Migrate game IDs from v4 to v5
 * @param {import("knex").Knex} knex - Knex instance
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
    await knex.transaction(async (trx) => {
        // Get all monitors that use the gamedig type
        const monitors = await trx("monitor")
            .select("id", "game")
            .where("type", "gamedig")
            .whereNotNull("game");

        // Update each monitor with the new game ID if it needs migration
        for (const monitor of monitors) {
            const oldGameId = monitor.game;
            const newGameId = gameDig4to5IdMap[oldGameId];

            if (newGameId) {
                await trx("monitor")
                    .where("id", monitor.id)
                    .update({ game: newGameId });
            }
        }
    });
};

/**
 * Revert game IDs from v5 back to v4
 * @param {import("knex").Knex} knex - Knex instance
 * @returns {Promise<void>}
 */
exports.down = async function (knex) {
    // Create reverse mapping from the same LUT
    const gameDig5to4IdMap = Object.fromEntries(
        Object.entries(gameDig4to5IdMap).map(([ v4, v5 ]) => [ v5, v4 ])
    );

    await knex.transaction(async (trx) => {
        // Get all monitors that use the gamedig type
        const monitors = await trx("monitor")
            .select("id", "game")
            .where("type", "gamedig")
            .whereNotNull("game");

        // Revert each monitor back to the old game ID if it was migrated
        for (const monitor of monitors) {
            const newGameId = monitor.game;
            const oldGameId = gameDig5to4IdMap[newGameId];

            if (oldGameId) {
                await trx("monitor")
                    .where("id", monitor.id)
                    .update({ game: oldGameId });
            }
        }
    });
};
