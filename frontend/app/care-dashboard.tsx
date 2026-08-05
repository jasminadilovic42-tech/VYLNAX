import React,{useCallback,useMemo,useState} from "react";
import {View,Text,StyleSheet,ScrollView,Pressable,ActivityIndicator,RefreshControl} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {api} from "@/src/api";
import {useApp} from "@/src/context/AppContext";
import {colors,radius,spacing} from "@/src/theme";
import {Card} from "@/src/components/ui";

type Risk="hoch"|"mittel"|"niedrig";
type Row={patient:any;risk_score:number;risk_level:Risk;adherence:number;missed:number;vital_alerts:number;narrative:string;reasons:string[];recommendations:string[]};
export default function CareDashboard(){
 const ins=useSafeAreaInsets(); const {setActivePatient}=useApp(); const [data,setData]=useState<any>(); const [loading,setLoading]=useState(true); const [filter,setFilter]=useState<"alle"|Risk>("alle");
 const load=useCallback(async()=>{setLoading(true);try{setData(await api("/care-dashboard?days=7",{access:true}));}finally{setLoading(false)}},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 const rows=useMemo<Row[]>(()=>((data?.patients||[]) as Row[]).filter(x=>filter==="alle"||x.risk_level===filter),[data,filter]);
 const open=(r:Row)=>{setActivePatient(r.patient);router.push("/weekly-intelligence")};
 return <View style={s.c}><View style={[s.h,{paddingTop:ins.top+8}]}><Pressable onPress={()=>router.back()}><Ionicons name="chevron-back" size={28}/></Pressable><View><Text style={s.ht}>PFK-/Arzt-Cockpit</Text><Text style={s.hs}>Priorisierte Patientenübersicht</Text></View><Pressable onPress={load}><Ionicons name="refresh" size={23} color={colors.brandPrimary}/></Pressable></View>
 <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>} contentContainerStyle={{padding:16,paddingBottom:80}}>{loading&&!data?<ActivityIndicator/>:<>
 <View style={s.stats}><Stat n={data?.high_risk||0} l="Hoch" tone={colors.error}/><Stat n={data?.medium_risk||0} l="Mittel" tone={colors.warning}/><Stat n={`${data?.average_adherence||0}%`} l="Ø Einnahme" tone={colors.success}/></View>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{(["alle","hoch","mittel","niedrig"] as const).map(x=><Pressable key={x} onPress={()=>setFilter(x)} style={[s.chip,filter===x&&s.chipOn]}><Text style={[s.chipT,filter===x&&s.chipTOn]}>{x==="alle"?"Alle":x[0].toUpperCase()+x.slice(1)}</Text></Pressable>)}</ScrollView>
 <Text style={s.section}>Arbeitsliste · {rows.length} Patienten</Text>
 {rows.map(r=><Pressable key={r.patient.id} onPress={()=>open(r)}><Card style={s.card}><View style={s.top}><View style={[s.avatar,{backgroundColor:r.risk_level==="hoch"?"#FDECEC":r.risk_level==="mittel"?"#FFF4DF":"#E8F7EF"}]}><Text style={s.initial}>{(r.patient.name||"?")[0]}</Text></View><View style={{flex:1}}><Text style={s.name}>{r.patient.name}</Text><Text style={s.meta}>{r.patient.room?`Zimmer ${r.patient.room} · `:""}{r.adherence}% Einnahmequote</Text></View><View style={[s.badge,{backgroundColor:r.risk_level==="hoch"?"#FDECEC":r.risk_level==="mittel"?"#FFF4DF":"#E8F7EF"}]}><Text style={[s.badgeT,{color:r.risk_level==="hoch"?colors.error:r.risk_level==="mittel"?colors.warning:colors.success}]}>{r.risk_score}</Text></View></View>
 <View style={s.metrics}><Text style={s.metric}>💊 {r.missed} versäumt</Text><Text style={s.metric}>❤️ {r.vital_alerts} Hinweise</Text><Text style={s.metric}>Risiko: {r.risk_level}</Text></View>
 <Text style={s.narr}>{r.narrative}</Text>{r.recommendations?.[0]&&<View style={s.todo}><Ionicons name="clipboard" size={16} color={colors.brandPrimary}/><Text style={s.todoT}>{r.recommendations[0]}</Text></View>}
 </Card></Pressable>)}
 {!rows.length&&<Card><Text style={{textAlign:"center"}}>Keine Patienten in diesem Filter.</Text></Card>}<Text style={s.dis}>{data?.disclaimer}</Text></>}</ScrollView></View>
}
function Stat({n,l,tone}:any){return <Card style={s.stat}><Text style={[s.statN,{color:tone}]}>{n}</Text><Text style={s.statL}>{l}</Text></Card>}
const s=StyleSheet.create({c:{flex:1,backgroundColor:colors.surfaceSecondary},h:{backgroundColor:"#fff",paddingHorizontal:16,paddingBottom:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderColor:colors.border},ht:{fontSize:20,fontWeight:"900"},hs:{fontSize:11,color:colors.onSurfaceTertiary},stats:{flexDirection:"row",gap:8},stat:{flex:1,alignItems:"center",paddingHorizontal:5},statN:{fontSize:25,fontWeight:"900"},statL:{fontSize:11,color:colors.onSurfaceTertiary,textAlign:"center"},filters:{gap:8,paddingVertical:16},chip:{paddingHorizontal:16,paddingVertical:9,borderRadius:99,backgroundColor:"#fff",borderWidth:1,borderColor:colors.border},chipOn:{backgroundColor:colors.brandPrimary,borderColor:colors.brandPrimary},chipT:{fontWeight:"700",color:colors.onSurfaceSecondary},chipTOn:{color:"#fff"},section:{fontSize:18,fontWeight:"900",marginBottom:10},card:{marginBottom:10},top:{flexDirection:"row",alignItems:"center",gap:10},avatar:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center"},initial:{fontSize:20,fontWeight:"900"},name:{fontSize:17,fontWeight:"900"},meta:{fontSize:12,color:colors.onSurfaceTertiary,marginTop:2},badge:{width:45,height:45,borderRadius:23,alignItems:"center",justifyContent:"center"},badgeT:{fontSize:17,fontWeight:"900"},metrics:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:12},metric:{fontSize:12,fontWeight:"700",color:colors.onSurfaceSecondary},narr:{marginTop:10,lineHeight:19,color:colors.onSurfaceSecondary},todo:{marginTop:10,flexDirection:"row",gap:8,backgroundColor:colors.brandSecondary,padding:10,borderRadius:radius.md},todoT:{flex:1,fontSize:12,lineHeight:17,fontWeight:"600"},dis:{fontSize:11,color:colors.onSurfaceTertiary,lineHeight:16,marginTop:12}})
