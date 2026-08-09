import React,{useEffect,useState}from"react";
import{View,Text,StyleSheet,ScrollView,TextInput,Pressable,Alert,ActivityIndicator}from"react-native";
import{useRouter}from"expo-router";
import{Ionicons}from"@expo/vector-icons";
import{useSafeAreaInsets}from"react-native-safe-area-context";
import{api,setToken}from"@/src/api";
import{useApp}from"@/src/context/AppContext";
import{useAuth}from"@/src/context/AuthContext";
import{colors}from"@/src/theme";

const roles=[
  {k:"patient",l:"Patient",pin:"0000"},
  {k:"doctor",l:"Arzt / Ärztin",pin:"1111"},
  {k:"caregiver",l:"Pflegefachkraft",pin:"2222"},
  {k:"relative",l:"Angehörige/r",pin:"3333"},
] as const;

type Role=(typeof roles)[number]["k"];
type Patient={id:string;name:string};

export default function AddPerson(){
  const r=useRouter(),i=useSafeAreaInsets();
  const{loadPatients}=useApp();
  const{refreshAccessUsers}=useAuth();
  const[role,setRole]=useState<Role>("patient");
  const[first,setFirst]=useState("");
  const[last,setLast]=useState("");
  const[extra,setExtra]=useState("");
  const[busy,setBusy]=useState(false);
  const[loadingPatients,setLoadingPatients]=useState(true);
  const[patients,setPatients]=useState<Patient[]>([]);
  const[selectedPatientId,setSelectedPatientId]=useState<string|null>(null);

  const ensureSession=async()=>{
    const data=await api<{session_token:string}>("/auth/session",{
      method:"POST",auth:false,body:{session_token:"local-dev"}
    });
    await setToken(data.session_token);
  };

  const fetchPatients=async()=>{
    setLoadingPatients(true);
    try{
      await ensureSession();
      const list=await api<Patient[]>("/patients");
      setPatients(list);
      setSelectedPatientId(current=>current||list[0]?.id||null);
    }catch(e:any){
      console.warn("Patienten konnten nicht geladen werden",e?.message||e);
      setPatients([]);
    }finally{setLoadingPatients(false)}
  };

  useEffect(()=>{fetchPatients();},[]);

  const save=async()=>{
    const name=`${first} ${last}`.trim();
    if(!name)return Alert.alert("Name fehlt","Bitte Vor- oder Nachnamen eingeben.");
    if(role!=="patient"&&!selectedPatientId){
      return Alert.alert("Patient wählen","Bitte zuerst einen betreuten Patienten auswählen oder zunächst einen Patienten anlegen.");
    }
    setBusy(true);
    try{
      await ensureSession();
      if(role==="patient"){
        await api("/patients",{method:"POST",body:{name}});
      }else if(role==="relative"){
        await api("/relatives",{method:"POST",body:{patient_id:selectedPatientId,first_name:first||name,last_name:last||"-",relationship:extra||"Angehörige/r"}});
      }else if(role==="caregiver"){
        await api("/caregivers",{method:"POST",body:{patient_id:selectedPatientId,first_name:first||name,last_name:last||"-",professional_role:extra||"Pflegefachkraft"}});
      }else if(role==="doctor"){
        await api("/doctors",{method:"POST",body:{patient_id:selectedPatientId,first_name:first||name,last_name:last||"-",specialization:extra||"Allgemeinmedizin",practice_name:"Nicht angegeben"}});
      }
      await loadPatients().catch(()=>{});
      await refreshAccessUsers();
      const pin=roles.find(x=>x.k===role)?.pin;
      Alert.alert("Gespeichert",`${name} wurde gespeichert. Start-PIN: ${pin}`,[{text:"Zur Anmeldung",onPress:()=>r.replace("/login")}]);
    }catch(e:any){
      const msg=String(e?.message||"Unbekannter Fehler");
      Alert.alert("Speichern fehlgeschlagen",msg.includes("Not authenticated")?"Die Sitzung konnte nicht hergestellt werden. Bitte Metro neu laden und erneut versuchen.":msg);
    }finally{setBusy(false)}
  };

  return <View style={[s.c,{paddingTop:i.top+8}]}>
    <View style={s.head}><Pressable onPress={()=>r.back()}><Ionicons name="close" size={26}/></Pressable><Text style={s.title}>Person hinzufügen</Text><View style={{width:26}}/></View>
    <ScrollView contentContainerStyle={{padding:18,paddingBottom:40}}>
      <Text style={s.lab}>Rolle</Text>
      <View style={s.roles}>{roles.map(x=><Pressable key={x.k} onPress={()=>setRole(x.k)} style={[s.chip,role===x.k&&s.on]}><Text style={[s.ct,role===x.k&&{color:"#fff"}]}>{x.l}</Text><Text style={[s.small,role===x.k&&{color:"#DCEEFF"}]}>PIN {x.pin}</Text></Pressable>)}</View>

      <Text style={s.lab}>Vorname</Text><TextInput value={first} onChangeText={setFirst} style={s.in}/>
      <Text style={s.lab}>Nachname</Text><TextInput value={last} onChangeText={setLast} style={s.in}/>

      {role!=="patient"&&<>
        <Text style={s.lab}>Betreute/r Patient/in</Text>
        {loadingPatients?<ActivityIndicator style={{marginVertical:16}} color={colors.brandPrimary}/>:patients.length===0?
          <View style={s.notice}><Text style={s.noticeTitle}>Noch kein Patient vorhanden</Text><Text style={s.noticeText}>Lege zuerst einen Patienten an. Danach kannst du PFK, Arzt oder Angehörige verbinden.</Text><Pressable onPress={()=>setRole("patient")} style={s.noticeBtn}><Text style={s.noticeBtnText}>Jetzt Patient anlegen</Text></Pressable></View>
          :<View style={{gap:8}}>{patients.map(p=><Pressable key={p.id} onPress={()=>setSelectedPatientId(p.id)} style={[s.patient,selectedPatientId===p.id&&s.patientOn]}><Ionicons name={selectedPatientId===p.id?"radio-button-on":"radio-button-off"} size={21} color={selectedPatientId===p.id?"#fff":colors.brandPrimary}/><Text style={[s.patientText,selectedPatientId===p.id&&{color:"#fff"}]}>{p.name}</Text></Pressable>)}</View>}
        <Text style={s.lab}>{role==="relative"?"Beziehung":role==="doctor"?"Fachrichtung":"Funktion"}</Text><TextInput value={extra} onChangeText={setExtra} style={s.in}/>
      </>}

      <Pressable disabled={busy||(role!=="patient"&&!selectedPatientId)} onPress={save} style={[s.btn,(busy||(role!=="patient"&&!selectedPatientId))&&{opacity:.5}]}>{busy?<ActivityIndicator color="#fff"/>:<Text style={s.bt}>Person speichern</Text>}</Pressable>
    </ScrollView>
  </View>
}

const s=StyleSheet.create({
  c:{flex:1,backgroundColor:colors.surfaceSecondary},head:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:16,backgroundColor:"#fff"},title:{fontSize:18,fontWeight:"800"},lab:{fontWeight:"700",marginTop:18,marginBottom:7,color:colors.onSurfaceSecondary},roles:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{width:"48%",padding:12,borderRadius:12,backgroundColor:"#fff",borderWidth:1,borderColor:colors.border},on:{backgroundColor:colors.brandPrimary},ct:{fontWeight:"800",color:colors.brandPrimary},small:{fontSize:12,color:colors.onSurfaceTertiary,marginTop:3},in:{height:52,borderRadius:12,backgroundColor:"#fff",borderWidth:1,borderColor:colors.border,paddingHorizontal:14,fontSize:16},btn:{height:54,backgroundColor:colors.brandPrimary,borderRadius:12,alignItems:"center",justifyContent:"center",marginTop:28},bt:{color:"#fff",fontWeight:"800",fontSize:17},notice:{backgroundColor:"#FFF7E8",borderWidth:1,borderColor:"#E6B85C",borderRadius:12,padding:14},noticeTitle:{fontWeight:"800",fontSize:16,color:"#6C4700"},noticeText:{marginTop:5,color:"#725B2C",lineHeight:20},noticeBtn:{marginTop:12,backgroundColor:colors.brandPrimary,borderRadius:10,padding:12,alignItems:"center"},noticeBtnText:{color:"#fff",fontWeight:"800"},patient:{backgroundColor:"#fff",borderWidth:1,borderColor:colors.border,borderRadius:12,padding:14,flexDirection:"row",alignItems:"center",gap:10},patientOn:{backgroundColor:colors.brandPrimary,borderColor:colors.brandPrimary},patientText:{fontWeight:"700",color:colors.onSurfaceSecondary}
});
