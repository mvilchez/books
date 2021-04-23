<template>
  <div class="row">
    <div class="column-2 next-lecture-column">
      <h2 class="heading">Lecturas en marcha</h2>
    </div>
    <div class="column-10">
      <div class="row">
        <div class="column-6" v-for="book in readingBooks" :key="book.id">
          <div class="next-lecture-pick">
            <div class="icon-read-div">
              <img src="@/assets/checklist.png" alt="Flag icon" class="icon" />
            </div>
            <div class="icon-delete-div">
              <button @click="$emit('finish-lecture', book.id)">
                <img src="@/assets/finish.svg" alt="Finish icon" class="icon" />
              </button>
            </div>
            <div class="quote-background"></div>
            <div class="description">
              {{ book.quote }}
            </div>
            <div class="img-container">
              <img
                :src="book.cover"
                alt="Black No More"
              />
            </div>
          </div>
          <div class="recomendador">
            <div class="icon-div">
              <img src="@/assets/lion.png" alt="Lion icon" class="icon" />
            </div>
            <p class="name">{{ book.curator.name }}</p>
            <p class="title">
              <a
                class="recomendador-link"
                href="https://www.fabulantes.com/2014/04/un-fuego-sobre-el-abismo-vernon-vinge/"
              >
                {{ book.curator.place }}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "reading-panel",
  props: {
    readingBooks: Array,
  },
  methods: {},
};
</script>

<style scoped>
.next-lecture-column {
  border-top: 2px solid #fff;
  margin-left: 15px;
  margin-right: 15px;
}

.next-lecture-pick {
  height: 400px;
  display: block;
  width: 100%;
  color: #000;
  position: relative;
  margin-left: 15px;
  margin-right: 15px;
  overflow: auto;
}

.next-empty-lecture-pick {
  height: 400px;
  display: block;
  width: 100%;
  color: #000;
  position: relative;
  margin-left: 15px;
  margin-right: 15px;
  overflow: auto;
  border: 1px;
}

.icon-read-div {
  float: right;
  height: 50px;
  width: 50px;
  margin: 12px 50px 0 0;
}

.icon-delete-div {
  float: left;
  height: 50px;
  width: 50px;
  margin: 12px 0px 0 25px;
}

.quote-background {
  margin: 0 55px 0 0;
  width: auto;
  height: 100%;
  background: #fff;
  z-index: 0;
}

.description {
  font-size: 27px;
  line-height: 32px;
  padding: 0 120px 0 15px;
  font-family: "Noto Sans JP", sans-serif;
  position: absolute;
  left: 0;
  bottom: 10%;
  width: auto;
  z-index: 100;
  margin: 0 190px 0 0;
  color: #000;
  font-size: large;
  font-style: italic;
}

.description-empty {
  font-size: 32px;
  line-height: 32px;
  font-family: "Noto Sans JP", sans-serif;
  position: absolute;
  left: 0;
  bottom: 70%;
  width: auto;
  z-index: 100;
  margin: 0 190px 0 0;
  padding: 0 0 0 15px;
  color: #000;
  font-size: large;
  font-style: italic;
}

.img-container {
  right: 100px;
  top: 45px;
  position: absolute;
}

.img-container img {
  max-width: 209px;
  max-height: 320px;
  display: block;
}

.recomendador {
  margin-left: 15px;
  color: #fff;
  margin-top: 15px;
  display: block;
}

.recomendador-link {
  color: #fff;
  text-decoration: none;
}

.icon-div {
  fill: #c51d12;
  float: left;
  height: 50px;
  width: 50px;
  margin: 12px 10px 0 0;
}

.heading {
  display: block;
  padding-left: 10px;
  font-size: 20px;
  text-align: right;
}
</style>