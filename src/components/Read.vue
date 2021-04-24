<template>
  <div class="container-lectures">
    <div class="row">
      <div class="column-2 left-column lecture-column">
        <h2 class="heading">Lecturas</h2>
      </div>
      <div class="column-10">
        <div class="row">
          <div
            class="lecture-box"
            v-for="book in sortedReadBooks.slice(0).slice(-6)"
            :key="book.id"
          >
            <div class="lecture-item">
              <a href="/kim-nieve-en-los-bolsillos" class="book-link">
                <img
                  class="book-cover"
                  :src="getCoverPath(book.cover)"
                  :title="book.title"
                  :alt="book.title"
                />
                <div class="item-overlay">
                  <p class="title">{{ book.title }}</p>
                  <div class="details">
                    <p class="details-author">{{ book.author }}</p>
                    <p class="details-audience">{{ book.audience }}</p>
                    <p class="details-genre">{{ book.genre }}</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="column-12 see-more-wrapper">
        <a
          id="bookList-seeMore"
          class="see-more-link"
          href="/books-music-movies/new-arrivals"
        >
          <span class="label">SEE MORE</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import sortByDateField from "../js/common-functions.js";

export default {
  name: "read",
  props: {
    readBooks: Array,
  },
  methods: {
    getCoverPath(cover) {
      return cover ? require(`@/assets/covers/${cover}`) : "";
    },
  },
  computed: {
    sortedReadBooks: function () {
      return sortByDateField(this.readBooks, "startDate");
    },
  },
};
</script>

<style scoped>
.lecture-box {
  display: flex;
}

.container-lectures {
  background-color: #b80f15;
  min-height: 500px;
  padding-top: 30px;
}

.left-column {
  text-align: right;
}

.lecture-column {
  border-top: 2px solid #fff;
  margin-left: 15px;
  margin-right: 15px;
}

.lecture-item {
  height: 264px;
  display: block;
  width: 100%;
  color: #000;
  position: relative;
  flex-basis: min-content;
  margin-left: 15px;
  margin-right: 15px;
  justify-content: space-around;
}

.heading {
  display: block;
  padding-left: 10px;
  font-size: 20px;
  text-align: right;
}

.book-link {
  text-decoration: none;
}

.book-cover {
  height: 280px;
  max-width: 250px;
  display: inline-block;
  position: relative;
}

.item-overlay {
  bottom: 75px;
  height: 150px;
  background-color: #e32b31;
  font-weight: 400;
  position: relative;
}

.title {
  font-size: 20px;
  font-weight: 400;
  text-align: left;
  color: #fff;
  margin-left: 15px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 120px;
  padding-top: 5px;
}

.details {
  margin: 10px 0 5px 15px;
  bottom: 0;
  width: 100%;
  color: #fff;
}

.details-author {
  margin: 15px 0 5px;
  font-size: 16px;
  color: #fff;
}

.details-audience,
.details-genre {
  margin: 10px 0 5px;
  font-size: 12px;
  color: #fff;
}
</style>