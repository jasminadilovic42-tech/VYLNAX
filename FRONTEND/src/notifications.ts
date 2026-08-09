import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "@/src/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushDevice(accessUser: any, patientId?: string | null) {
  if (Platform.OS === "web" || !Device.isDevice || !accessUser) return { supported: false };
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { supported: true, granted: false };
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("alerts", {
      name: "VYLNAX Alarme", importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250], sound: "default", lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("EAS_PROJECT_ID_MISSING");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api("/push-devices/register", { method: "POST", access: true, body: {
    token, platform: Platform.OS, access_user_id: accessUser.id, patient_id: patientId || accessUser.patient_id || null,
    device_name: Device.deviceName || Device.modelName || "Mobilgerät",
  }});
  return { supported: true, granted: true, token };
}

export async function unregisterPushDevice(token: string) {
  return api("/push-devices/unregister", { method: "POST", access: true, body: { token } });
}
