<template>
     <div class="container-lectures">
            <div class="row">
                <div class="column-2 left-column lecture-column">
                    <h2 class="heading">Lecturas</h2>
                </div>
                <div class="column-10">
                    <div class="row">
                        <div class="lecture-box">
                            <div class="lecture-item">
                                <a href="/kim-nieve-en-los-bolsillos" class="book-link">
                                    <img class="book-cover" src="@/assets/covers/nieve-bolsillos.jpg" title="Owed" alt="Owed by Joshua Bennett" data-reactid="373">
                                    <div class="item-overlay" data-reactid="374">
                                        <p class="title" data-reactid="375">Nieve en los bolsillos</p>
                                        <div class="details" data-reactid="376">
                                            <p class="details-author" data-reactid="377">Kim</p>
                                            <p class="details-audience" data-reactid="378">Adult</p>
                                            <p class="details-genre" data-reactid="379">Comic</p>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                        <div class="lecture-box">
                            <div class="lecture-item">
                                <a href="/klara" class="book-link">
                                    <img class="book-cover" src="@/assets/covers/abismo_cielo.jpg" title="Klara and the Sun" alt="Klara and the Sun" data-reactid="382">
                                    <div class="item-overlay" data-reactid="383">
                                        <p class="title" data-reactid="384">Un abismo en el cielo</p>
                                        <div class="details" data-reactid="385">
                                            <p class="details-author" data-reactid="386">Vernor Vringe</p>
                                            <p class="details-audience" data-reactid="387">Adult</p>
                                            <p class="details-genre" data-reactid="388">Science Fiction</p>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                        <div class="lecture-box">
                            <div class="lecture-item">
                                <a href="/music" class="book-link">
                                    <img class="book-cover" src="@/assets/covers/stoner.jpg" title="Music for the Dead and the Resurrected" alt="Music for the Dead and the Resurrected" data-reactid="391"><div class="item-overlay" data-reactid="392">
                                        <p class="title" data-reactid="393">Stoner</p>
                                        <div class="details" data-reactid="394">
                                            <p class="details-author" data-reactid="395">John Williams</p>
                                            <p class="details-audience" data-reactid="396">Adult</p>
                                            <p class="details-genre" data-reactid="397">Fiction</p>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                        <div class="lecture-box">
                            <div class="lecture-item">
                                <a href="/milk" class="book-link">
                                    <img class="book-cover" src="@/assets/covers/lemmy.jpeg" title="Milk Blood Heat" alt="Milk Blood Heat">
                                    <div class="item-overlay" data-reactid="401">
                                        <p class="title" data-reactid="402">Lemmy</p>
                                        <div class="details" data-reactid="403">
                                            <p class="details-author" data-reactid="404">Ian Kilmister</p>
                                            <p class="details-audience" data-reactid="405">Adult</p>
                                            <p class="details-genre" data-reactid="406">Biography</p>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                        <div class="lecture-box">
                            <div class="lecture-item">
                                <a href="/milk" class="book-link">
                                    <img class="book-cover" src="@/assets/covers/criopolis.jpeg" title="Milk Blood Heat" alt="Milk Blood Heat">
                                    <div class="item-overlay" data-reactid="401">
                                        <p class="title" data-reactid="402">Criopolis</p>
                                        <div class="details" data-reactid="403">
                                            <p class="details-author" data-reactid="404">Lois McMaster Bujold</p>
                                            <p class="details-audience" data-reactid="405">Adult</p>
                                            <p class="details-genre" data-reactid="406">Science fiction / Space Opera</p>
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>
                        <div class="lecture-box">
                            <div class="lecture-item">
                                <a href="/milk" class="book-link">
                                    <img class="book-cover" src="@/assets/covers/viaje-londres-genova.jpg" title="Milk Blood Heat" alt="Milk Blood Heat">
                                    <div class="item-overlay" data-reactid="401">
                                        <p class="title" data-reactid="402">Viaje de Londres a Génova a través de Inglaterra, Portugal, España y Francia</p>
                                        <div class="details" data-reactid="403">
                                            <p class="details-author" data-reactid="404">Giuseppe Baretti</p>
                                            <p class="details-audience" data-reactid="405">Adult</p>
                                            <p class="details-genre" data-reactid="406">Literatura de viajes</p>
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
                    <a id="bookList-seeMore" class="see-more-link" href="/books-music-movies/new-arrivals">
                        <span class="label">SEE MORE</span>
                    </a>
                </div>
            </div>
        </div>
</template>

<script>
export default {
  name: "read"
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
    border-top: 2px solid #FFF;
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
    height: 140px;
    font-family: "Kievit-Book", "Helvetica", "arial";
    background-color: #E32B31;
    font-weight: 400;
    position: relative;
}

.title {
    font-size: 20px;
    font-weight: 400;
    text-align: left;
    color: #fff;
    margin-left: 15px;

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