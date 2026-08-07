import React from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { Image } from "expo-image";

import { Ionicons } from "@expo/vector-icons";

import { usePlayer } from "../context/PlayerContext";
import { COLORS } from "../constants/colors";

export default function PlayerScreen() {

  const {
    currentSong,
    isPlaying,
    pause,
    resume,
    duration,
    position,
  } = usePlayer();

  if (!currentSong) return null;

  return (

    <View style={styles.container}>

      <Image
        source={{ uri: currentSong.thumbnail }}
        style={styles.cover}
      />

      <Text style={styles.title}>
        {currentSong.title}
      </Text>

      <Text style={styles.artist}>
        {currentSong.artist}
      </Text>

      <View
        style={[
        styles.progress,
{
        width:
        duration > 0
        ? `${(position / duration) * 100}%`
        : "0%",
},
]}
/>

      <View style={styles.timeRow}>
        <Text>
{Math.floor(position / 60000)}:
{String(Math.floor((position % 60000) / 1000)).padStart(2, "0")}
</Text>

<Text>
{Math.floor(duration / 60000)}:
{String(Math.floor((duration % 60000) / 1000)).padStart(2, "0")}
</Text>
      </View>

      <View style={styles.controls}>

        <TouchableOpacity>

          <Ionicons
            name="play-skip-back"
            size={36}
            color={COLORS.primary}
          />

        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            isPlaying
              ? pause()
              : resume()
          }
        >

          <Ionicons
            name={
              isPlaying
                ? "pause-circle"
                : "play-circle"
            }
            size={80}
            color={COLORS.primary}
          />

        </TouchableOpacity>

        <TouchableOpacity>

          <Ionicons
            name="play-skip-forward"
            size={36}
            color={COLORS.primary}
          />

        </TouchableOpacity>

      </View>

    </View>

  );

}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#fff",
alignItems:"center",
paddingTop:70,
},

cover:{
width:320,
height:320,
borderRadius:25,
},

title:{
fontSize:24,
fontWeight:"700",
marginTop:30,
},

artist:{
marginTop:8,
fontSize:18,
color:"#777",
},

progressBackground:{
marginTop:40,
width:"90%",
height:6,
backgroundColor:"#ddd",
borderRadius:10,
},

progress:{
width:"25%",
height:6,
backgroundColor:COLORS.primary,
borderRadius:10,
},

timeRow:{
width:"90%",
flexDirection:"row",
justifyContent:"space-between",
marginTop:8,
},

controls:{
flexDirection:"row",
alignItems:"center",
justifyContent:"space-evenly",
width:"100%",
marginTop:40,
},

});