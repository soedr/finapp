import mathjs from 'mathjs'
import moment from 'moment'
import uniqBy from 'lodash/uniqBy'
import { mapGetters } from 'vuex'
import { focus } from 'vue-focus'
import CategoryCreate from './categories/CategoryCreate.vue'
import CategoryList from './categories/CategoryList.vue'

export default {
  directives: { focus: focus },
  components: { CategoryCreate, CategoryList },

  watch: {
    '$route'(to, from) {
      if (this.$route.params.id) {
        const routeId = +this.$route.params.id
        const routePath = this.$route.path
        if (/(categories)/g.test(routePath)) this.setCategory(routeId)
        if (/(accounts)/g.test(routePath)) this.setAccound(routeId)
      }
    },

    action() {
      this.fillValues()
    },

    isUpdateTrn() {
      if (this.$store.state.trnForm.isUpdateTrn) {
        this.fillValues()
      }
    }
  },

  mounted() {
    this.fillValues()

    document.addEventListener('keyup', (event) => {
      if (event.keyCode === 27) { // escape key
        this.$store.commit('closeTrnForm')
        this.show.categories = false
      }
    })
  },

  data() {
    return {
      isShowEditActions: false,
      errors: null,
      show: {
        categories: false
      },
      lastUsedCategories: [],
      values: {}
    }
  },

  computed: {
    ...mapGetters(['trns', 'accounts', 'categories']),

    action() {
      return this.$store.state.trnForm.action
    },

    categoryId() {
      return this.$store.state.trnForm.categoryId
    },

    selectedCategory() {
      const category = this.categories.find(category => category.id === this.categoryId)
      if (category) {
        return category
      }
      return {}
    },

    isShowCategories() {
      return this.$store.state.trnForm.isShowCategories
    }
  },

  methods: {
    fillValues() {
      // Create
      if (this.$store.state.trnForm.action === 'create') {
        const lastTrn = this.$store.getters.trns[0]
        this.$store.commit('setTrnFormCategoryId', lastTrn.categoryId)
        this.values = {
          date: moment(),
          accountId: lastTrn.accountId,
          accountName: lastTrn.accountName,
          amount: null,
          categoryId: lastTrn.categoryId,
          categoryName: lastTrn.categoryName,
          categoryIcon: lastTrn.categoryIcon,
          type: 0,
          currency: lastTrn.currency,
          description: ''
        }
      }

      // Update
      if (this.$store.state.trnForm.action === 'update') {
        const trn = this.trns.find(trn => trn.id === this.$store.state.trnForm.isUpdateTrn)
        this.$store.commit('setTrnFormCategoryId', trn.categoryId)
        this.values = {
          id: trn.id,
          date: moment(trn.date),
          accountId: trn.accountId,
          amount: trn.amount,
          categoryId: trn.categoryId,
          categoryIcon: trn.categoryIcon,
          type: trn.type,
          currency: trn.currency,
          description: trn.description
        }
      }

      const lastTrnsUnicCategory = uniqBy(this.trns.slice(0, 50), 'categoryId').slice(0, 15)
      const lastUsedCategoriesIdsFromTrns = lastTrnsUnicCategory.map(trn => trn.categoryId)
      this.lastUsedCategories = this.categories
        .filter(category => lastUsedCategoriesIdsFromTrns.indexOf(category.id) >= 0)
        .slice(0, 15)
    },

    toogleCategoriesPop() {
      this.$store.commit('toogleCategoriesPop')
    },

    onClickCategoryContent(category) {
      this.setCategory(category.id)
    },

    setCategory(categoryId) {
      this.$store.commit('setTrnFormCategoryId', categoryId)
      // Add selected category if it doesn't exist in lastUsedCategories
      if (!this.lastUsedCategories.find(cat => cat.id === this.categoryId)) {
        this.lastUsedCategories = [...this.lastUsedCategories.slice(0, 14), this.selectedCategory]
      }
    },

    setTrnType() {
      this.values.type = (this.values.type === 1) ? 0 : 1
    },

    setAccound(accountId) {
      const account = this.accounts.find(account => account.id === accountId)
      if (account) {
        this.values = {
          ...this.values,
          ...account
        }
      }
    },

    setNextPrevDate(way) {
      let date
      if (way === 'prev') date = moment(this.values.date).subtract(1, 'days')
      if (way === 'next') date = moment(this.values.date).add(1, 'days')
      this.values.date = date
    },

    async onSubmitForm() {
      this.$store.commit('showLoader')

      function calc(number) {
        try {
          return mathjs.chain(number.replace(/\s/g, '')).eval().round().value
        } catch (error) {
          console.error('calc:', error.message)
          return false
        }
      }

      try {
        console.group('TrnForm: onSubmitForm')
        console.log('Action', this.action)
        const currentTime = moment().format('HH:mm:ss')
        const day = moment(this.values.date).format('D.MM.YY')
        const date = moment(`${day} ${currentTime}`, 'D.MM.YY HH:mm:ss').valueOf()
        const amount = String(this.values.amount)
        const dataFromTrns = []

        // Empty
        if (!amount) {
          console.log('empty amount')
          this.errors = 'Empty amount'
          throw new Error('components/TrnForm: Empty amount')
        }

        // One amount
        if (amount && amount.indexOf(',') === -1) {
          const calcAmount = calc(amount)
          console.log('TrnForm@One amount:', calcAmount)

          if (calcAmount && calcAmount > 0) {
            dataFromTrns.push({
              ...this.values,
              amount: calcAmount,
              date
            })
            this.errors = false
          } else {
            this.errors = 'One amount: wrong number or less than 0'
          }
        }

        // Few amounts
        if (amount && amount.indexOf(',') !== -1) {
          const amountsList = amount.split(',')

          for (const amountItem of amountsList) {
            const calcAmount = calc(amountItem)
            console.log('Few:', calcAmount)

            if (calcAmount && calcAmount > 0) {
              dataFromTrns.push({
                ...this.values,
                amount: calcAmount,
                date
              })
              this.errors = false
            } else {
              this.errors = 'Few amount: wrong number or less than 0'
            }
          }
        }

        if (!this.errors) {
          // Create
          if (this.action === 'create') {
            const isAddedTrns = await this.$store.dispatch('addTrns', dataFromTrns)
            console.log(isAddedTrns)

            if (isAddedTrns) {
              this.values.amount = ''
              this.values.description = ''
              this.filter = ''
            }
          }

          // Update only one trn
          if (this.action === 'update') {
            const updatedTrnId = await this.$store.dispatch('updateTrn', dataFromTrns[0])
            if (updatedTrnId) {
              this.$store.commit('closeTrnForm')
            }
          }
        }
      } catch (error) {
        console.error(error)
      } finally {
        this.$store.commit('closeLoader')
        console.groupEnd()
      }
    }
  }
}
