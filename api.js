const PREFIX = process.env.ZUSERS_API_PREFIX;
const PLATFORM_ID = process.env.ZUSERS_PLATFORM_ID;
async function LinebotSignin(data) {
  const {userId, type, groupId} = data;
  const response = await fetch(`${PREFIX}/auth/linebot/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      platformid: PLATFORM_ID,
    },
    body: JSON.stringify({
      userId,
      type,
      groupId,
    }),
  });

  const result = await response.json();
  return [result, response.status];
}

async function CreatePlatformDevice(data, token) {
  const {
    deviceId: deviceNo,
    status,
    time,
    location,
    lastMaintenanceDate,
    isFirstDieselReplaced,
    date,
  } = data || {};
  let {lastMaintenanceHours, runHours} = data || {};
  if (runHours) {
    runHours = parseInt(runHours);
  }

  if (lastMaintenanceHours) {
    lastMaintenanceHours = parseInt(lastMaintenanceHours);
  }

  const response = await fetch(`${PREFIX}/platform/device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      platformid: PLATFORM_ID,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      deviceNo,
      status,
      runHours,
      time,
      location,
      lastMaintenanceHours,
      lastMaintenanceDate,
      isFirstDieselReplaced,
      date,
    }),
  });

  const result = await response.json();
  return [result, response.status];
}

async function UpdatePlatformDevice(id, data, token) {
  const {
    deviceId: deviceNo,
    lastMaintenanceDate,
    isFirstDieselReplaced,
    status,
    location,
    date,
  } = data || {};
  let {lastMaintenanceHours, runHours} = data || {};
  if (runHours) {
    runHours = parseInt(runHours);
  }
  if (lastMaintenanceHours) {
    lastMaintenanceHours = parseInt(lastMaintenanceHours);
  }

  const response = await fetch(`${PREFIX}/platform/device/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      platformid: PLATFORM_ID,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      deviceNo,
      status,
      runHours,
      location,
      lastMaintenanceDate,
      lastMaintenanceHours,
      isFirstDieselReplaced,
      date,
    }),
  });

  const result = await response.json();
  return [result, response.status];
}

async function DeletePlatformDevice(id, token) {
  const response = await fetch(`${PREFIX}/platform/device/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      platformid: PLATFORM_ID,
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();
  return [result, response.status];
}

async function GetPlatformDeviceByDeviceNo(deviceNo, token) {
  const response = await fetch(
    `${PREFIX}/platform/device/deviceNo/${deviceNo}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        platformid: PLATFORM_ID,
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const result = await response.json();
  return [result, response.status];
}

module.exports = {
  LinebotSignin,
  CreatePlatformDevice,
  UpdatePlatformDevice,
  GetPlatformDeviceByDeviceNo,
  DeletePlatformDevice,
};
