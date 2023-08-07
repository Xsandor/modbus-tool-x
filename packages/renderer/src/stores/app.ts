import {defineStore} from 'pinia';

export default defineStore({
  id: 'app',
  state: () => ({
    rawItems: [] as string[],
  }),
  getters: {
    items: (state): Array<{name: string; amount: number}> =>
      state.rawItems.reduce(
        (items, item) => {
          const existingItem = items.find(it => it.name === item);

          if (!existingItem) {
            items.push({name: item, amount: 1});
          } else {
            existingItem.amount++;
          }

          return items;
        },
        [] as Array<{name: string; amount: number}>,
      ),
  },
  actions: {
    addItem(name: string) {
      this.rawItems.push(name);
    },

    removeItem(name: string) {
      const i = this.rawItems.lastIndexOf(name);
      if (i > -1) this.rawItems.splice(i, 1);
    },
  },
});
