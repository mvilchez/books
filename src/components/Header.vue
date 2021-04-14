<template>
    <div id="book-header" class="row header">
        <div class="home-square">
            <img src="@/assets/home.svg" alt="Home icon" class="home-icon" />
        </div>
        <div class="year-square">
            <div class="year-content">
                2021 <img src="@/assets/current.svg" alt="Flag icon" class="icon"/> 
            </div>
        </div> 
        <div class="year-square">
            <div class="year-content">
                2020
            </div>
        </div> 
        <div class="year-square">
            <div class="year-content">
                2019
            </div>
        </div> 
    </div>
</template>

<script>
export default {
  name: "book-header"
};
</script>

<style scoped>
.header {
  background-color: black;
  justify-content: flex-end;
}

.year-active {
  background-color: greenyellow;
}

.home-square {
  flex-grow: 0;
  flex-shrink: 0;
  flex-basis: 5em;
  background-color: #0050ef;
  color: #ffffff;
  margin-right: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
}

.year-square {
  flex-grow: 0;
  flex-shrink: 0;
  flex-basis: 10em;
  background-color: #0050ef;
  color: #ffffff;
  margin-right: 10px;
  height: 100px;
  margin-top: 10px;
  margin-bottom: 10px;
}

.year-content {
  position: absolute;
  width: 50%;
  height: 50%;
  font-family: "Noto Sans JP", sans-serif;
  font-size: xx-large;
  padding: 10px;
}

.home-icon {
  margin-left: 10px;
  margin-top: 20px;
  width: 55px;
}
</style>