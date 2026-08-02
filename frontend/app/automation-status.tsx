import React,{useCallback,useState} from "react";
import {View,Text,StyleSheet,ScrollView,Pressable,ActivityIndicator,Alert} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useFocusEffect,useRouter} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {api} from "@/src/api";
import {colors,spacing,radius} from "@/src/theme";
import {Card} from "@/src/components/ui";

export default function AutomationStatus(){
 const r=useRouter(),ins=useSafeAreaInsets();
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[running,setRunning]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{setData(await api('/automation/status',{access:true,timeoutMs:15000}))}catch(e:any){Alert.alert('Fehler',e.message||'Status nicht verfügbar')}finally{setLoading(false)}},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 const run=async()=>{setRunning(true);try{const x=await api('/automation/run-manual',{method:'POST',access:true,timeoutMs:30000});Alert.alert('Automatik geprüft',`${x.patients||0} Patient(en) wurden geprüft.`);await load()}catch(e:any){Alert.alert('Fehler',e.message||'Automatik konnte nicht gestartet werden')}finally{setRunning(false)}};
 const last=data?.runs?.[0];
 return <View style={s.c}><View style={[s.h,{paddingTop:ins.top+8}]}><Pressable onPress={()=>r.back()}><Ionicons name="arrow-back" size={25}/></Pressable><Text style={s.ht}>Automatik & Versand</Text><View style={{width:25}}/></View><ScrollView contentContainerStyle={{padding:spacing.lg,paddingBottom:90}}>
  <Card><Text style={s.t}>Server-Automatik</Text><Text style={s.p}>Zeitzone: {data?.timezone||'Europe/Berlin'}</Text><View style={s.badge}><Ionicons name={data?.configured?'checkmark-circle':'warning'} size={18} color={data?.configured?colors.success:colors.warning}/><Text style={s.badgeText}>{data?.configured?'Cron-Schlüssel eingerichtet':'CRON_SECRET fehlt noch'}</Text></View><Pressable style={s.btn} onPress={run} disabled={running}>{running?<ActivityIndicator color="#fff"/>:<Ionicons name="play" size={18} color="#fff"/>}<Text style={s.bt}>Jetzt manuell prüfen</Text></Pressable></Card>
  {loading?<ActivityIndicator style={{marginTop:30}}/>:<>
   <Text style={s.sec}>Letzter Lauf</Text><Card><Text style={s.t}>{last?new Date(last.started_at).toLocaleString('de-DE'):'Noch kein Lauf'}</Text>{last&&<><Text style={s.p}>{last.patients} Patient(en) geprüft</Text><Text style={s.p}>Lokale Serverzeit: {last.local_time}</Text><Text style={s.p}>Erinnerungsprüfungen: {(last.reminders||[]).reduce((a:number,x:any)=>a+(x.checked||0),0)}</Text></>}</Card>
   <Text style={s.sec}>Letzte Zustellungen</Text>{(data?.deliveries||[]).slice(0,30).map((d:any)=><Card key={d.id} style={{marginBottom:10}}><View style={s.row}><View style={{flex:1}}><Text style={s.t}>{d.title}</Text><Text style={s.p}>{d.body}</Text><Text style={s.meta}>{new Date(d.created_at).toLocaleString('de-DE')} · Rollen: {(d.roles||[]).join(', ')||'—'}</Text></View><View style={[s.count,{backgroundColor:(d.result?.sent||0)>0?'#E7F5EF':'#FDF3E6'}]}><Text style={{fontWeight:'800',color:(d.result?.sent||0)>0?colors.success:colors.warning}}>{d.result?.sent||0}</Text></View></View></Card>)}
   {!data?.deliveries?.length&&<Card><Text style={s.p}>Noch keine automatischen Zustellungen protokolliert.</Text></Card>}
  </>}</ScrollView></View>
}
const s=StyleSheet.create({c:{flex:1,backgroundColor:colors.surfaceSecondary},h:{backgroundColor:colors.surface,paddingHorizontal:spacing.lg,paddingBottom:spacing.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.border},ht:{fontSize:20,fontWeight:'800',color:colors.onSurface},t:{fontSize:15,fontWeight:'800',color:colors.onSurface},p:{fontSize:13,color:colors.onSurfaceTertiary,marginTop:4},meta:{fontSize:11,color:colors.onSurfaceTertiary,marginTop:8},sec:{fontSize:16,fontWeight:'800',color:colors.onSurface,marginTop:22,marginBottom:10},badge:{flexDirection:'row',alignItems:'center',gap:7,marginTop:12},badgeText:{fontSize:13,fontWeight:'700',color:colors.onSurface},btn:{minHeight:48,borderRadius:radius.md,backgroundColor:colors.brandPrimary,marginTop:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},bt:{color:'#fff',fontWeight:'800'},row:{flexDirection:'row',alignItems:'center',gap:12},count:{minWidth:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'}});
