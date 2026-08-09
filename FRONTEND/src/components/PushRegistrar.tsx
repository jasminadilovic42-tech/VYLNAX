import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { registerPushDevice } from "@/src/notifications";

export default function PushRegistrar(){
 const {accessUser}=useAuth(); const {activePatient}=useApp(); const router=useRouter();
 useEffect(()=>{ if(accessUser) registerPushDevice(accessUser,activePatient?.id).catch(()=>{}); },[accessUser?.id,activePatient?.id]);
 useEffect(()=>{ const sub=Notifications.addNotificationResponseReceivedListener(r=>{ const target=r.notification.request.content.data?.route; if(typeof target==='string') router.push(target as any); else router.push('/notifications');}); return()=>sub.remove();},[router]);
 return null;
}
