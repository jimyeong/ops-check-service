export async function ensureDeviceExists(client,device_id: bigint, device_name: string) {
    await client.query(`
        INSERT INTO device (id, name)
        VALUES($1, $2)
        ON CONFLICT(id) DO NOTHING`,[device_id, device_name]);
}
