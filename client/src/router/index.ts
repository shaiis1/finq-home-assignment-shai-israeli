import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import RandomListView from '../views/RandomListView.vue';
import SavedListView from '../views/SavedListView.vue';
import ProfileDetailView from '../views/ProfileDetailView.vue';

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/random', name: 'random', component: RandomListView },
  { path: '/saved', name: 'saved', component: SavedListView },
  { path: '/profile/:id', name: 'profile', component: ProfileDetailView, props: true },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
