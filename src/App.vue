<template>
  <div id="app" class="body">
    <book-header />
    <reading
      v-bind:readingBooks="readingBooks"
      v-bind:readBooks="readBooks"
      @finish-lecture="finishLecture"
      @add-book="startReadingBook"
    />
    <read v-bind:readBooks="readBooks" />
  </div>
</template>

<script>
import BookHeader from "@/components/Header.vue";
import Reading from "@/components/Reading.vue";
import Read from "@/components/Read.vue";
import moment from "moment";


export default {
  name: "App",
  components: {
    BookHeader,
    Reading,
    Read,
  },
  data() {
    return {
      readingBooks: [
        {
          id: 1,
          title: "Un fuego sobre el abismo",
          author: "Vernor Vringe",
          quote:
            "Vernor Vinge es una pluma grande, inmensa, cuya formación e ideas han abonado algunas de las mejores novelas de este género jamás escritas. Uno de los pocos escritores vivos que pertenece a la época de los grandes clásicos de la ciencia-ficción, a ese tiempo tan añorado que nos abandona poco a poco, a cuenta gotas, conforme el tiempo avanza inexorable.",
          cover: "fuego_abismo_vernor_vringe.jpg",
          startDate: "27/03/2021",
          curator: {
            name: "Francisco Martínez Hidalgo",
            place: "Fabulantes",
            url:
              "https://www.fabulantes.com/2014/04/un-fuego-sobre-el-abismo-vernon-vinge/",
          },
        },
        {
          id: 2,
          title: "Las quince primeras vidas de Harry August",
          author: "Claire North",
          quote:
            "Harry August nació en 1919 en el lavabo de señoras de una estación de tren. Su vida no tuvo mayor relevancia: participó en la Segunda Guerra Mundial y volvió a casa a heredar las tierras de sus padres, donde se quedó hasta morir en 1989. Entonces, volvió a nacer otra vez, en 1919, pero con los recuerdos de su anterior vida intactos.",
          cover: "quince-primeras-vidas.jpeg",
          startDate: "08/04/2021",
          curator: {
            name: "Laura Huelin",
            place: "La Nave Invisible",
            url:
              "https://lanaveinvisible.com/2016/09/01/resena-las-primeras-quince-vidas-de-harry-august/",
          },
        },
      ],
      readBooks: [
        {
          id: 1,
          title: "Nieve en los bolsillos",
          author: "Kim",
          cover: "nieve-bolsillos.jpg",
          genre: "Comic",
          audience: "Adult",
          startDate: "03/04/2021",
          endDate: "08/04/2021",
        },
        {
          id: 2,
          title: "Un abismo en el cielo",
          author: "Vernor Vringe",
          cover: "abismo_cielo.jpg",
          genre: "Science Fiction",
          audience: "Adult",
          startDate: "20/02/2021",
          endDate: "27/03/2021",
        },
        {
          id: 3,
          title: "Stoner",
          author: "John Williams",
          cover: "stoner.jpg",
          genre: "Fiction",
          audience: "Adult",
          startDate: "31/01/2021",
          endDate: "01/03/2021",
        },
        {
          id: 4,
          title: "Lemmy",
          author: "Ian Kilmister",
          cover: "lemmy.jpeg",
          genre: "Biography",
          audience: "Adult",
          startDate: "23/01/2021",
          endDate: "27/02/2021",
        },
        {
          id: 5,
          title: "Criopolis",
          author: "Lois McMaster Bujold",
          cover: "criopolis.jpeg",
          genre: "Science fiction / Space Opera",
          audience: "Adult",
          startDate: "07/01/2021",
          endDate: "31/01/2021",
        },
        {
          id: 6,
          title:
            "Viaje de Londres a Génova a través de Inglaterra, Portugal, España y Francia",
          author: "Giuseppe Baretti",
          cover: "viaje-londres-genova.jpg",
          genre: "Literatura de viajes",
          audience: "Young",
          startDate: "07/01/2021",
          endDate: "31/01/2021",
        },
      ],
    };
  },
  methods: {
    finishLecture(id) {
      let book = this.readingBooks.find( (book) => book.id === id);  

      this.readingBooks = this.readingBooks.filter((book) => book.id !== id);

      let readBook= {
          title: book.title,
          author: book.author,
          cover: book.cover,
          genre: book.genre,
          audience: "Adult",
          startDate: book.startDate,
          endDate: moment().format("DD/MM/YYYY"),
      };
      this.readBooks.push(readBook);

    },
    startReadingBook(book) {
      let id = 0;

      if (this.readingBooks.length > 0) {
        id = this.readingBooks[this.readingBooks.length - 1].id + 1;
      }

      this.readingBooks = [...this.readingBooks, { ...book, id }];
    },
  },
};
</script>

<style>
#app {
  font-family: Impact, Haettenschweiler, Charcoal, sans-serif;
  color: #fff;
  font-weight: 400;
}

.row {
  display: flex;
}

.column-2 {
  flex: 15%;
}

.column-10 {
  flex: 85%;
}

.column-6 {
  flex: 50%;
}

.icon {
  width: 35px;
  height: 35px;
}

.see-more-wrapper {
  margin-top: 150px;
  margin-bottom: 30px;
  text-align: center;
}

.see-more-link {
  border: 2px solid #fff;
  border-radius: 22px;
  color: #fff;
  padding: 14px 18px 12px 14px;
  position: relative;
  text-decoration: none;
}
</style>
