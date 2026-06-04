import { pool } from "../../core/db/pool";
import { insertWeatherRavenReading } from "../../core/db/repositories/ravens/weatherRavenRepo";
import type { WeatherRaven } from "../../domain/ravens/weatherRaven";

export async function weatherRavenService(reading: WeatherRaven){
    // const client = await pool.connect();
    try {
        // await client.query("BEGIN");
        const result =await insertWeatherRavenReading(reading);
        if (!result) {
            throw new Error("Failed to insert weather raven reading");
        }
        // await client.query("COMMIT");
        return true
    } catch (e) {
        console.error(`Failed to insert weather raven reading: ${e}`);
        return false;
    }
}