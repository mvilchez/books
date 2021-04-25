<template>
  <div id="book-header" class="row header">
    <div class="home-square">
      <img src="@/assets/home.svg" alt="Home icon" class="home-icon" />
    </div>
    <div class="box">
      <select v-model="selectedYear" @change="onChange($event)">
        <option value="0">Year:</option>
        <option
          v-for="year in years"
          :value="year"
          :key="year"
          :selected="year == selectedYear"
        >
          {{ year }}
        </option>
      </select>
    </div>
  </div>
</template>

<script>
export default {
  name: "book-header",
  props: {
    currentYear: Number,
  },
  data() {
    return {
      selectedYear: this.currentYear, // First option will be selected by default
    };
  },
  methods: {
    onChange: function (event) {
      console.log("Event " + event.target.value);
      this.$emit("changed-selected-year", this.selectedYear);
    },
  },
  computed: {
    years() {
      const year = new Date().getFullYear();
      return Array.from(
        { length: year - 2008 },
        (value, index) => 2009 + index
      );
    },
  },
};
</script>

<style scoped>
.header {
  background-color: black;
  justify-content: flex-end;
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
.box {
  position: relative;
  margin-right: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
}

.box select {
  background-color: #0050ef;
  color: white;
  padding: 12px;
  width: 250px;
  border: none;
  font-size: 20px;
  box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
  -webkit-appearance: button;
  appearance: button;
  outline: none;
}

.box::before {
  content: "\f13a";
  font-family: FontAwesome;
  position: absolute;
  top: 0;
  right: 0;
  width: 20%;
  height: 100%;
  text-align: center;
  font-size: 28px;
  line-height: 45px;
  color: rgba(255, 255, 255, 0.5);
  background-color: rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

.box:hover::before {
  color: rgba(255, 255, 255, 0.6);
  background-color: rgba(255, 255, 255, 0.2);
}

.box select option {
  padding: 30px;
}

.home-icon {
  margin-left: 10px;
  margin-top: 20px;
  width: 55px;
}
</style>