import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

type Memory = { id: string; label: string; value: string; updated_at?: string };

export default function AssistantMemory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePatient } = useApp();
  const { accessUser } = useAuth();
  const [items, setItems] = useState<Memory[]>([]);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = accessUser?.role === "doctor" || accessUser?.role === "caregiver";

  const load = useCallback(async () => {
    if (!activePatient) return;
    try {
      const res = await api<{ memories: Memory[] }>(`/patients/${activePatient.id}/assistant-context`);
      setItems(res.memories || []);
    } finally { setLoading(false); }
  }, [activePatient]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const save = async () => {
    if (!activePatient || !label.trim() || !value.trim()) return;
    setSaving(true);
    try {
      await api(`/patients/${activePatient.id}/assistant-memory`, { method: "POST", access: true, body: { label: label.trim(), value: value.trim() } });
      setLabel(""); setValue(""); await load();
      Alert.alert("Gespeichert", "Der Merkpunkt steht dem KI-Assistenten jetzt als Patientenkontext zur Verfügung.");
    } catch { Alert.alert("Fehler", "Der Merkpunkt konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  };

  return <View style={styles.container}>
    <View style={[styles.header,{paddingTop:insets.top+spacing.sm}]}>
      <Pressable onPress={()=>router.back()} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.onSurface}/></Pressable>
      <View style={{flex:1}}><Text style={styles.title}>KI-Merkpunkte</Text><Text style={styles.sub}>{activePatient?.name}</Text></View>
    </View>
    <ScrollView contentContainerStyle={{padding:spacing.lg,paddingBottom:60}}>
      <View style={styles.info}><Ionicons name="information-circle" size={20} color={colors.brandPrimary}/><Text style={styles.infoText}>Nur bestätigte, langfristig relevante Angaben speichern. Keine Vermutungen oder Diagnosen eintragen.</Text></View>
      {canEdit && <View style={styles.card}>
        <Text style={styles.cardTitle}>Neuen Merkpunkt speichern</Text>
        <TextInput value={label} onChangeText={setLabel} placeholder="Bezeichnung, z. B. bevorzugte Einnahme" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input}/>
        <TextInput value={value} onChangeText={setValue} placeholder="Bestätigte Information" placeholderTextColor={colors.onSurfaceTertiary} style={[styles.input,{minHeight:80}]} multiline/>
        <Pressable onPress={save} disabled={saving || !label.trim() || !value.trim()} style={[styles.save,(!label.trim()||!value.trim())&&{opacity:.5}]}>
          {saving?<ActivityIndicator color="#fff"/>:<><Ionicons name="save" size={18} color="#fff"/><Text style={styles.saveText}>Speichern</Text></>}
        </Pressable>
      </View>}
      <Text style={styles.section}>Gespeicherte Merkpunkte</Text>
      {loading ? <ActivityIndicator color={colors.brandPrimary}/> : items.length===0 ? <View style={styles.empty}><Text style={styles.emptyText}>Noch keine bestätigten Merkpunkte gespeichert.</Text></View> : items.map(item=><View key={item.id} style={styles.memory}><Text style={styles.memoryLabel}>{item.label}</Text><Text style={styles.memoryValue}>{item.value}</Text></View>)}
    </ScrollView>
  </View>
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:colors.surfaceSecondary},header:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:spacing.md,paddingBottom:spacing.md,backgroundColor:colors.surface,borderBottomWidth:1,borderBottomColor:colors.border},back:{width:42,height:42,alignItems:"center",justifyContent:"center"},title:{fontSize:20,fontWeight:"800",color:colors.onSurface},sub:{fontSize:12,color:colors.onSurfaceTertiary},info:{flexDirection:"row",gap:8,padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.brandSecondary,marginBottom:spacing.md},infoText:{flex:1,fontSize:12,lineHeight:18,color:colors.onSurfaceSecondary},card:{backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.md,borderWidth:1,borderColor:colors.border,gap:spacing.sm},cardTitle:{fontSize:15,fontWeight:"800",color:colors.onSurface},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:12,color:colors.onSurface,backgroundColor:colors.surfaceSecondary},save:{height:48,borderRadius:radius.md,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7},saveText:{color:"#fff",fontWeight:"800"},section:{fontSize:16,fontWeight:"800",color:colors.onSurface,marginTop:spacing.lg,marginBottom:spacing.sm},memory:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,marginBottom:spacing.sm},memoryLabel:{fontSize:12,fontWeight:"800",color:colors.brandPrimary,textTransform:"uppercase"},memoryValue:{fontSize:14,color:colors.onSurface,lineHeight:20,marginTop:4},empty:{padding:spacing.lg,alignItems:"center"},emptyText:{color:colors.onSurfaceTertiary,textAlign:"center"}
});
