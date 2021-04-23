<template>
  <div class="container-next-lectures" >
    <start-reading-book @add-book="addBook"  />
    <reading-panel  v-bind:readingBooks="readingBooks"  @finish-lecture="finishLecture" />
    <div class="row">
      <div class="column-12 see-more-wrapper">
        <a
          id="nextList-seeMore"
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
import StartReadingBook from "./StartReadingBook.vue";
import ReadingPanel from "./ReadingPanel.vue";

export default {
  components: { StartReadingBook, ReadingPanel },
  name: "reading",
  props: {
    readingBooks: Array,
    readBooks: Array,
  },
  methods: {
    addBook(book) {
      let id = 0;

      if (this.readingBooks.length > 0) {
        id = this.readingBooks[this.readingBooks.length - 1].id + 1;
      }

      this.readingBooks = [...this.readingBooks, { ...book, id }];
    },
    finishLecture(id) {

      let book = this.readingBooks.find( (book) => book.id === id);  

      this.readingBooks = this.readingBooks.filter((book) => book.id !== id);

      console.log("Book cover "+book.cover);

      let readBook= {
          title: book.title,
          author: book.author,
         // cover: require('@/assets/covers/'+book.cover),
          genre: book.genre,
          audience: "Adult",
      };
      this.readBooks.push(readBook);
    },
  },
};
</script>

<style scoped>
.container-next-lectures {
  background-color: #e32b31;
  padding-top: 30px;
  min-height: 375px;
}


</style>
