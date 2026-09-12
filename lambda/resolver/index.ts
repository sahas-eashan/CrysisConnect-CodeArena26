import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Pool } from "pg";

type AppSyncEvent = {
  arguments: Record<string, any>;
  identity?: {
    sub?: string;
    claims?: Record<string, any>;
  };
  info: {
    fieldName: string;
    parentTypeName: string;
  };
};

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5
});

const lambdaClient = new LambdaClient({});

type DbClient = {
  query: (text: string, values?: any[]) => Promise<{ rows: Record<string, any>[] }>;
};

function getGroups(event: AppSyncEvent) {
  const rawGroups = event.identity?.claims?.["cognito:groups"];
  if (Array.isArray(rawGroups)) return rawGroups as string[];
  if (typeof rawGroups === "string") return rawGroups.split(",");
  return [];
}

function requireGroup(event: AppSyncEvent, allowed: string[]) {
  const groups = getGroups(event);
  if (allowed.some((group) => groups.includes(group))) return;
  throw new Error("Unauthorized");
}

function getProfileRole(event: AppSyncEvent) {
  const groups = getGroups(event);
  if (groups.includes("government")) return "government";
  if (groups.includes("ngo")) return "ngo_org_member";
  if (groups.includes("ngo_org_member")) return "ngo_org_member";
  if (groups.includes("ngo_individual")) return "ngo_individual";

  const roleClaim = event.identity?.claims?.["custom:role"];
  if (
    roleClaim === "government" ||
    roleClaim === "ngo" ||
    roleClaim === "ngo_org_member" ||
    roleClaim === "ngo_individual" ||
    roleClaim === "citizen"
  ) {
    return roleClaim === "ngo" ? "ngo_org_member" : roleClaim;
  }

  return "citizen";
}

function getProfileName(event: AppSyncEvent, userId: string) {
  const claims = event.identity?.claims ?? {};
  const candidates = [claims.name, claims.email, claims.phone_number]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  return candidates[0] ?? `Citizen ${userId.slice(0, 8)}`;
}

async function ensureProfile(client: DbClient, event: AppSyncEvent, userId: string) {
  await client.query(
    `INSERT INTO profiles (id, role, full_name, phone, email, is_available)
     VALUES ($1, $2::user_role, $3, $4, $5, true)
     ON CONFLICT (id) DO UPDATE
     SET role = CASE
           WHEN profiles.role = 'citizen'::user_role AND EXCLUDED.role <> 'citizen'::user_role THEN EXCLUDED.role
           ELSE profiles.role
         END,
         full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
         phone = COALESCE(profiles.phone, EXCLUDED.phone),
         email = COALESCE(profiles.email, EXCLUDED.email)`,
    [
      userId,
      getProfileRole(event),
      getProfileName(event, userId),
      typeof event.identity?.claims?.phone_number === "string"
        ? event.identity.claims.phone_number
        : null,
      typeof event.identity?.claims?.email === "string" ? event.identity.claims.email : null
    ]
  );
}

function geoJsonSql(value: string | null | undefined) {
  return value && value.trim()
    ? `ST_SetSRID(ST_GeomFromGeoJSON($$${value}$$), 4326)::geography`
    : "NULL";
}

function mapDisaster(row: Record<string, any>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    severity: row.severity,
    status: row.status,
    affectedArea: row.affected_area ?? null,
    centerPoint: row.center_point ?? null,
    radiusKm: row.radius_km == null ? null : Number(row.radius_km),
    secondaryRisks: row.secondary_risks ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at
  };
}

function mapSafeZone(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? null,
    boundary: row.boundary ?? null,
    capacity: row.capacity,
    currentOccupancy: row.current_occupancy,
    amenities: row.amenities ?? [],
    disasterId: row.disaster_id,
    status: row.status
  };
}

function mapResource(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status,
    location: row.location ?? null,
    managedBy: row.managed_by,
    orgId: row.org_id,
    disasterId: row.disaster_id
  };
}

function mapRequest(row: Record<string, any>) {
  return {
    id: row.id,
    requestedBy: row.requested_by,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    quantityNeeded: row.quantity_needed,
    urgency: row.urgency,
    status: row.status,
    fulfilledBy: row.fulfilled_by,
    location: row.location ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at
  };
}

function mapSOS(row: Record<string, any>) {
  return {
    id: row.id,
    senderId: row.sender_id,
    location: row.location ?? null,
    type: row.type,
    description: row.description,
    status: row.status,
    assignedTo: row.assigned_to,
    disasterId: row.disaster_id,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    resolvedAt: row.resolved_at?.toISOString?.() ?? row.resolved_at
  };
}

function mapProfile(row: Record<string, any>) {
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    isAvailable: row.is_available,
    distance: row.distance == null ? null : Number(row.distance)
  };
}

function mapNews(row: Record<string, any>) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    disasterId: row.disaster_id,
    authorId: row.author_id,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at
  };
}

function mapAlert(row: Record<string, any>) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    channel: row.channel ?? [],
    targetArea: row.target_area ?? null,
    targetRoles: row.target_roles ?? [],
    disasterId: row.disaster_id,
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at
  };
}

function normalizeTargetRoles(inputRoles: unknown) {
  if (!Array.isArray(inputRoles)) return [] as string[];

  const expanded = inputRoles.flatMap((value) => {
    if (typeof value !== "string") return [];

    const role = value.trim();
    if (!role) return [];
    if (role === "ngo") return ["ngo_individual", "ngo_org_member"];
    return [role];
  });

  return [...new Set(expanded)];
}

function mapOrganization(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    approvalStatus: row.approval_status,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at
  };
}

async function triggerWorker(payload: Record<string, any>) {
  const functionName = process.env.WORKER_FUNCTION_NAME;
  if (!functionName) return;

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify(payload))
    })
  );
}

export async function handler(event: AppSyncEvent) {
  const userId = event.identity?.sub ?? "system";
  const args = event.arguments ?? {};

  if (event.info.parentTypeName === "Mutation" && userId !== "system") {
    await ensureProfile(pool, event, userId);
  }

  switch (event.info.fieldName) {
    case "getDisasters": {
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(affected_area) AS affected_area, ST_AsGeoJSON(center_point) AS center_point
         FROM disasters
         WHERE ($1::text IS NULL OR status::text = $1)
         ORDER BY created_at DESC`,
        [args.status ?? null]
      );
      return rows.map(mapDisaster);
    }
    case "getDisaster": {
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(affected_area) AS affected_area, ST_AsGeoJSON(center_point) AS center_point
         FROM disasters WHERE id = $1 LIMIT 1`,
        [args.id]
      );
      return rows[0] ? mapDisaster(rows[0]) : null;
    }
    case "getSafeZones": {
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(location) AS location, ST_AsGeoJSON(boundary) AS boundary
         FROM safe_zones
         WHERE ($1::uuid IS NULL OR disaster_id = $1)
         ORDER BY created_at DESC`,
        [args.disasterId ?? null]
      );
      return rows.map(mapSafeZone);
    }
    case "getNearestSafeZone": {
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(location) AS location, ST_AsGeoJSON(boundary) AS boundary
         FROM safe_zones
         WHERE current_occupancy < capacity AND status = 'active'
         ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
         LIMIT 1`,
        [args.lon, args.lat]
      );
      return rows[0] ? mapSafeZone(rows[0]) : null;
    }
    case "getResources": {
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(location) AS location
         FROM resources
         WHERE ($1::uuid IS NULL OR disaster_id = $1)
           AND ($2::text IS NULL OR category = $2)
         ORDER BY created_at DESC`,
        [args.disasterId ?? null, args.category ?? null]
      );
      return rows.map(mapResource);
    }
    case "getResourceRequests": {
      requireGroup(event, ["ngo", "government"]);
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(location) AS location
         FROM resource_requests
         WHERE ($1::text IS NULL OR status = $1)
         ORDER BY created_at DESC`,
        [args.status ?? null]
      );
      return rows.map(mapRequest);
    }
    case "getMyResourceRequests": {
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(location) AS location
         FROM resource_requests
         WHERE requested_by = $1
           AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC`,
        [userId, args.status ?? null]
      );
      return rows.map(mapRequest);
    }
    case "getSOSSignals": {
      requireGroup(event, ["ngo", "government"]);
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(location) AS location
         FROM sos_signals
         WHERE ($1::text IS NULL OR status::text = $1)
         ORDER BY created_at DESC`,
        [args.status ?? null]
      );
      return rows.map(mapSOS);
    }
    case "getMySOSSignals": {
      const client = await pool.connect();
      try {
        const { rows } = await client.query(
          `SELECT *, ST_AsGeoJSON(location) AS location
           FROM sos_signals
           WHERE sender_id = $1
             AND ($2::text IS NULL OR status::text = $2)
           ORDER BY created_at DESC`,
          [userId, args.status ?? null]
        );

        const signals = await Promise.all(
          rows.map(async (row) => {
            if (!row.location) {
              return {
                ...mapSOS(row),
                nearestResponders: []
              };
            }

            const responders = await client.query(
              `SELECT id, role, full_name, phone, email, is_available,
                      ST_Distance(location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) AS distance
               FROM profiles
               WHERE role IN ('ngo_individual', 'ngo_org_member')
                 AND is_available = true
                 AND location IS NOT NULL
               ORDER BY distance ASC
               LIMIT 3`,
              [row.location]
            );

            return {
              ...mapSOS(row),
              nearestResponders: responders.rows.map(mapProfile)
            };
          })
        );

        return signals;
      } finally {
        client.release();
      }
    }
    case "getAlerts": {
      const role = getProfileRole(event);
      const { rows } = await pool.query(
        `SELECT *, ST_AsGeoJSON(target_area) AS target_area
         FROM notifications
         WHERE ($1::uuid IS NULL OR disaster_id = $1)
           AND (
             target_roles IS NULL
             OR cardinality(target_roles) = 0
             OR $2::text = ANY(target_roles::text[])
           )
         ORDER BY created_at DESC`,
        [args.disasterId ?? null, role]
      );
      return rows.map(mapAlert);
    }
    case "getNewsUpdates": {
      const { rows } = await pool.query(
        `SELECT * FROM news_updates
         WHERE ($1::uuid IS NULL OR disaster_id = $1)
         ORDER BY created_at DESC`,
        [args.disasterId ?? null]
      );
      return rows.map(mapNews);
    }
    case "getOrganizations": {
      requireGroup(event, ["government"]);
      const { rows } = await pool.query(
        `SELECT * FROM organizations
         WHERE ($1::text IS NULL OR approval_status::text = $1)
         ORDER BY created_at DESC`,
        [args.status ?? null]
      );
      return rows.map(mapOrganization);
    }
    case "getDashboardStats": {
      const [disasters, sos, resources, safeZones, users] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count FROM disasters WHERE status = 'active'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM sos_signals WHERE status IN ('pending', 'assigned', 'in_progress')`),
        pool.query(`SELECT COUNT(*)::int AS count FROM resources`),
        pool.query(`SELECT COUNT(*)::int AS count FROM safe_zones WHERE status = 'active'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM profiles`)
      ]);
      return {
        activeDisasters: disasters.rows[0]?.count ?? 0,
        pendingSOS: sos.rows[0]?.count ?? 0,
        totalResources: resources.rows[0]?.count ?? 0,
        totalSafeZones: safeZones.rows[0]?.count ?? 0,
        totalUsers: users.rows[0]?.count ?? 0
      };
    }
    case "createDisaster": {
      requireGroup(event, ["government"]);
      const input = args.input;
      const { rows } = await pool.query(
        `INSERT INTO disasters (title, description, type, severity, status, affected_area, center_point, radius_km, secondary_risks, created_by)
         VALUES ($1, $2, $3, $4, 'active',
           ${geoJsonSql(input.affectedArea)},
           ${geoJsonSql(input.centerPoint)},
           $5, $6, $7)
         RETURNING *, ST_AsGeoJSON(affected_area) AS affected_area, ST_AsGeoJSON(center_point) AS center_point`,
        [input.title, input.description ?? null, input.type, input.severity, input.radiusKm ?? null, input.secondaryRisks ?? [], userId]
      );
      return mapDisaster(rows[0]);
    }
    case "updateDisaster": {
      requireGroup(event, ["government"]);
      const input = args.input;
      const { rows } = await pool.query(
        `UPDATE disasters
         SET title = $2,
             description = $3,
             type = $4,
             severity = $5,
             affected_area = ${geoJsonSql(input.affectedArea)},
             center_point = ${geoJsonSql(input.centerPoint)},
             radius_km = $6,
             secondary_risks = $7,
             updated_at = now()
         WHERE id = $1
         RETURNING *, ST_AsGeoJSON(affected_area) AS affected_area, ST_AsGeoJSON(center_point) AS center_point`,
        [args.id, input.title, input.description ?? null, input.type, input.severity, input.radiusKm ?? null, input.secondaryRisks ?? []]
      );
      return mapDisaster(rows[0]);
    }
    case "createSafeZone": {
      requireGroup(event, ["government"]);
      const input = args.input;
      const { rows } = await pool.query(
        `INSERT INTO safe_zones (name, location, boundary, capacity, current_occupancy, amenities, disaster_id, status, created_by)
         VALUES ($1, ${geoJsonSql(input.location)}, ${geoJsonSql(input.boundary)}, $2, 0, $3, $4, 'active', $5)
         RETURNING *, ST_AsGeoJSON(location) AS location, ST_AsGeoJSON(boundary) AS boundary`,
        [input.name, input.capacity, input.amenities ?? [], input.disasterId ?? null, userId]
      );
      return mapSafeZone(rows[0]);
    }
    case "updateSafeZoneOccupancy": {
      requireGroup(event, ["government"]);
      const { rows } = await pool.query(
        `UPDATE safe_zones
         SET current_occupancy = GREATEST(0, current_occupancy + $2)
         WHERE id = $1
         RETURNING *, ST_AsGeoJSON(location) AS location, ST_AsGeoJSON(boundary) AS boundary`,
        [args.id, args.delta]
      );
      return mapSafeZone(rows[0]);
    }
    case "createResource": {
      requireGroup(event, ["ngo", "government"]);
      const input = args.input;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const normalizedName = typeof input.name === "string" ? input.name.trim() : "";
        if (!normalizedName) {
          throw new Error("Resource name is required.");
        }

        const quantityToAdd = Math.max(0, Number(input.quantity ?? 0));
        const existingResourceResult = await client.query(
          `SELECT *
           FROM resources
           WHERE lower(trim(name)) = lower(trim($1))
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`,
          [normalizedName]
        );

        const existingResource = existingResourceResult.rows[0];

        if (existingResource) {
          const nextQuantity = Math.max(0, Number(existingResource.quantity ?? 0) + quantityToAdd);
          const { rows } = await client.query(
            `UPDATE resources
             SET quantity = $2,
                 location = COALESCE(${geoJsonSql(input.location)}, location),
                 managed_by = $3,
                 org_id = COALESCE($4, org_id),
                 disaster_id = COALESCE($5, disaster_id),
                 status = CASE
                   WHEN $2 <= 0 THEN 'depleted'::resource_status
                   WHEN $2 < 10 THEN 'low'::resource_status
                   ELSE 'available'::resource_status
                 END
             WHERE id = $1
             RETURNING *, ST_AsGeoJSON(location) AS location`,
            [existingResource.id, nextQuantity, userId, input.orgId ?? null, input.disasterId ?? null]
          );

          await client.query("COMMIT");
          return mapResource(rows[0]);
        }

        const { rows } = await client.query(
          `INSERT INTO resources (name, category, quantity, unit, status, location, managed_by, org_id, disaster_id)
           VALUES (
             $1,
             $2,
             $3,
             $4,
             CASE
               WHEN COALESCE($3, 0) <= 0 THEN 'depleted'::resource_status
               WHEN COALESCE($3, 0) < 10 THEN 'low'::resource_status
               ELSE 'available'::resource_status
             END,
             ${geoJsonSql(input.location)},
             $5,
             $6,
             $7
           )
           RETURNING *, ST_AsGeoJSON(location) AS location`,
          [
            normalizedName,
            input.category ?? null,
            input.quantity ?? null,
            input.unit ?? null,
            userId,
            input.orgId ?? null,
            input.disasterId ?? null
          ]
        );

        await client.query("COMMIT");
        return mapResource(rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    case "updateResource": {
      requireGroup(event, ["ngo", "government"]);
      const input = args.input;
      const { rows } = await pool.query(
        `UPDATE resources
         SET name = $2,
             category = $3,
             quantity = $4,
             unit = $5,
             location = ${geoJsonSql(input.location)},
             disaster_id = $6,
             status = CASE
               WHEN COALESCE($4, 0) <= 0 THEN 'depleted'
               WHEN COALESCE($4, 0) < 10 THEN 'low'
               ELSE 'available'
             END
         WHERE id = $1
         RETURNING *, ST_AsGeoJSON(location) AS location`,
        [args.id, input.name, input.category ?? null, input.quantity ?? null, input.unit ?? null, input.disasterId ?? null]
      );
      return mapResource(rows[0]);
    }
    case "requestResource": {
      const input = args.input;
      const { rows } = await pool.query(
        `INSERT INTO resource_requests (requested_by, resource_id, resource_name, quantity_needed, urgency, status, location)
         VALUES ($1, $2, $3, $4, $5, 'pending', ${geoJsonSql(input.location)})
         RETURNING *, ST_AsGeoJSON(location) AS location`,
        [userId, input.resourceId ?? null, input.resourceName ?? null, input.quantityNeeded ?? null, input.urgency ?? "normal"]
      );
      return mapRequest(rows[0]);
    }
    case "fulfillResourceRequest": {
      requireGroup(event, ["ngo", "government"]);
      await ensureProfile(pool, event, userId);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const requestResult = await client.query(
          `SELECT *
           FROM resource_requests
           WHERE id = $1
           FOR UPDATE`,
          [args.id]
        );

        const requestRow = requestResult.rows[0];
        if (!requestRow) {
          throw new Error("Resource request not found.");
        }

        const requestedAmount = Math.max(0, Number(requestRow.quantity_needed ?? 0));
        const normalizedRequestName =
          typeof requestRow.resource_name === "string" ? requestRow.resource_name.trim() : "";
        let resourceRow: Record<string, any> | undefined;

        if (requestRow.resource_id) {
          const resourceResult = await client.query(
            `SELECT *
             FROM resources
             WHERE id = $1
             FOR UPDATE`,
            [requestRow.resource_id]
          );
          resourceRow = resourceResult.rows[0];
        }

        if (!resourceRow && normalizedRequestName) {
          const resourceResult = await client.query(
            `SELECT *
             FROM resources
             WHERE lower(trim(name)) = lower(trim($1))
             ORDER BY COALESCE(quantity, 0) DESC, created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [requestRow.resource_name]
          );
          resourceRow = resourceResult.rows[0];
        }

        let updatedRequest;

        if (!resourceRow) {
          const pendingResult = await client.query(
            `UPDATE resource_requests
             SET status = CASE
                   WHEN lower(COALESCE(status, 'pending')) = 'partially_fulfilled' THEN 'partially_fulfilled'
                   ELSE 'pending'
                 END
             WHERE id = $1
             RETURNING *, ST_AsGeoJSON(location) AS location`,
            [args.id]
          );
          updatedRequest = pendingResult.rows[0];
        } else {
          const availableAmount = Math.max(0, Number(resourceRow.quantity ?? 0));

          if (availableAmount <= 0) {
            await client.query(`DELETE FROM resources WHERE id = $1`, [resourceRow.id]);

            const pendingResult = await client.query(
              `UPDATE resource_requests
               SET status = CASE
                     WHEN lower(COALESCE(status, 'pending')) = 'partially_fulfilled' THEN 'partially_fulfilled'
                     ELSE 'pending'
                   END,
                   resource_id = COALESCE(resource_id, $2)
               WHERE id = $1
               RETURNING *, ST_AsGeoJSON(location) AS location`,
              [args.id, resourceRow.id]
            );
            updatedRequest = pendingResult.rows[0];
          } else if (availableAmount >= requestedAmount) {
            const remainingResourceAmount = Math.max(0, availableAmount - requestedAmount);

            if (remainingResourceAmount <= 0) {
              await client.query(`DELETE FROM resources WHERE id = $1`, [resourceRow.id]);
            } else {
              await client.query(
                `UPDATE resources
                 SET quantity = $2,
                     status = CASE
                       WHEN $2 <= 0 THEN 'depleted'::resource_status
                       WHEN $2 < 10 THEN 'low'::resource_status
                       ELSE 'available'::resource_status
                     END
                 WHERE id = $1`,
                [resourceRow.id, remainingResourceAmount]
              );
            }

            const fulfilledResult = await client.query(
              `UPDATE resource_requests
               SET status = 'fulfilled',
                   fulfilled_by = $2,
                   resource_id = COALESCE(resource_id, $3)
               WHERE id = $1
               RETURNING *, ST_AsGeoJSON(location) AS location`,
              [args.id, userId, resourceRow.id]
            );
            updatedRequest = fulfilledResult.rows[0];
          } else {
            const remainingRequestAmount = Math.max(0, requestedAmount - availableAmount);

            await client.query(`DELETE FROM resources WHERE id = $1`, [resourceRow.id]);

            const pendingResult = await client.query(
              `UPDATE resource_requests
               SET quantity_needed = $2,
                   status = CASE WHEN $2 <= 0 THEN 'fulfilled' ELSE 'partially_fulfilled' END,
                   fulfilled_by = $3,
                   resource_id = COALESCE(resource_id, $4)
               WHERE id = $1
               RETURNING *, ST_AsGeoJSON(location) AS location`,
              [args.id, remainingRequestAmount, userId, resourceRow.id]
            );
            updatedRequest = pendingResult.rows[0];
          }
        }

        await client.query("COMMIT");
        return mapRequest(updatedRequest);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    case "createSOS": {
      const input = args.input;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const insert = await client.query(
          `INSERT INTO sos_signals (sender_id, location, type, description, status, disaster_id)
           VALUES ($1, ${geoJsonSql(input.location)}, $2, $3, 'pending', $4)
           RETURNING *, ST_AsGeoJSON(location) AS location`,
          [userId, input.type, input.description ?? null, input.disasterId ?? null]
        );
        const responders =
          input.location == null
            ? { rows: [] as Record<string, any>[] }
            : await client.query(
                `SELECT id, role, full_name, phone, email, is_available,
                        ST_Distance(location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) AS distance
                 FROM profiles
                 WHERE role IN ('ngo_individual', 'ngo_org_member')
                   AND is_available = true
                   AND location IS NOT NULL
                 ORDER BY distance ASC
                 LIMIT 3`,
                [input.location]
              );
        await client.query("COMMIT");

        await triggerWorker({
          action: "SOS_ALERT",
          sos: insert.rows[0],
          responders: responders.rows
        });

        return {
          ...mapSOS(insert.rows[0]),
          nearestResponders: responders.rows.map(mapProfile)
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    case "acceptSOS": {
      requireGroup(event, ["ngo", "government"]);
      const { rows } = await pool.query(
        `UPDATE sos_signals
         SET status = 'assigned', assigned_to = $2
         WHERE id = $1
         RETURNING *, ST_AsGeoJSON(location) AS location`,
        [args.id, userId]
      );
      return mapSOS(rows[0]);
    }
    case "resolveSOS": {
      requireGroup(event, ["ngo", "government"]);
      const { rows } = await pool.query(
        `UPDATE sos_signals
         SET status = 'resolved', resolved_at = now()
         WHERE id = $1
         RETURNING *, ST_AsGeoJSON(location) AS location`,
        [args.id]
      );
      return mapSOS(rows[0]);
    }
    case "createNewsUpdate": {
      requireGroup(event, ["ngo", "government"]);
      const input = args.input;
      const { rows } = await pool.query(
        `INSERT INTO news_updates (title, content, category, disaster_id, author_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.title, input.content, input.category ?? null, input.disasterId ?? null, userId]
      );
      return mapNews(rows[0]);
    }
    case "sendAlert": {
      requireGroup(event, ["government"]);
      const input = args.input;
      const targetRoles = normalizeTargetRoles(input.targetRoles);
      await pool.query(
        `INSERT INTO notifications (title, body, type, channel, target_area, target_roles, disaster_id, created_by)
         VALUES ($1, $2, 'disaster_alert', $3, ${geoJsonSql(input.targetArea)}, $4, $5, $6)`,
        [input.title, input.body, input.channel, targetRoles, input.disasterId ?? null, userId]
      );

      await triggerWorker({
        action: "DIRECT_ALERT",
        alert: {
          ...input,
          targetRoles
        }
      });
      return {
        sent: Array.isArray(input.channel) ? input.channel.length : 1,
        channel: Array.isArray(input.channel) ? input.channel.join(", ") : String(input.channel)
      };
    }
    case "registerOrganization": {
      const input = args.input;
      const { rows } = await pool.query(
        `INSERT INTO organizations (name, type, description, approval_status, created_by)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING *`,
        [input.name, input.type ?? null, input.description ?? null, userId]
      );
      return mapOrganization(rows[0]);
    }
    case "approveOrganization": {
      requireGroup(event, ["government"]);
      const status = args.approved ? "approved" : "rejected";
      const { rows } = await pool.query(
        `UPDATE organizations
         SET approval_status = $2::org_approval, approved_by = $3
         WHERE id = $1
         RETURNING *`,
        [args.id, status, userId]
      );
      return mapOrganization(rows[0]);
    }
    default:
      throw new Error(`Unknown field: ${event.info.fieldName}`);
  }
}
