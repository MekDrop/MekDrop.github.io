<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    class="site-notice-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card dark class="site-notice-dialog__card">
      <q-card-section class="site-notice-dialog__content">
        <div class="site-notice-dialog__icon" aria-hidden="true">
          <q-icon :name="icon" />
        </div>
        <p class="site-notice-dialog__message">
          {{ message }}
        </p>
      </q-card-section>

      <q-separator class="site-notice-dialog__rule" />

      <q-card-actions align="right" class="site-notice-dialog__actions">
        <q-btn
          outline
          no-caps
          class="site-notice-dialog__confirm"
          :label="t('form.ok')"
          @click="emit('update:modelValue', false)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss">
.site-notice-dialog .q-dialog__inner {
  padding: var(--app-ui-space-md);
}

.site-notice-dialog__card {
  width: min(31rem, calc(100vw - 2rem));
  overflow: hidden;
  color: #d9ffe8;
  background:
    linear-gradient(rgba(150, 255, 224, 0.06), rgba(150, 255, 224, 0.06))
      0 0 / 100% 1px no-repeat,
    radial-gradient(circle at top, rgba(110, 255, 230, 0.08), transparent 55%),
    rgba(5, 10, 8, 0.96) !important;
  border: 1px solid rgba(150, 255, 224, 0.52);
  border-radius: var(--app-ui-border-radius) !important;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.58),
    inset 0 0 32px rgba(110, 255, 230, 0.025);
  font-family: var(--app-ui-font-family);
  backdrop-filter: blur(14px);
}

.site-notice-dialog__content {
  display: flex;
  align-items: center;
  gap: var(--app-ui-space-md);
  padding: var(--app-ui-space-lg);
}

.site-notice-dialog__icon {
  display: grid;
  flex: 0 0 3rem;
  width: 3rem;
  height: 3rem;
  place-items: center;
  color: #d9ffe8;
  font-size: 1.35rem;
  background: rgba(150, 255, 224, 0.07);
  border: 1px solid rgba(150, 255, 224, 0.38);
}

.site-notice-dialog__message {
  margin: 0;
  color: rgba(217, 255, 232, 0.86);
  font-size: 0.88rem;
  line-height: 1.65;
  letter-spacing: 0.045em;
}

.site-notice-dialog__rule {
  background: rgba(150, 255, 224, 0.32);
}

.site-notice-dialog__actions {
  padding: var(--app-ui-space-md) var(--app-ui-space-lg)
    var(--app-ui-space-lg);
}

.site-notice-dialog__confirm {
  min-width: 7.5rem;
  color: #d9ffe8;
  border-color: rgba(150, 255, 224, 0.58);
}

.site-notice-dialog__confirm .q-btn__content {
  font-family: var(--app-ui-font-family);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.site-notice-dialog__confirm:hover {
  color: #ffffff;
  background: rgba(150, 255, 224, 0.08);
}
</style>

<script setup>
import { useI18n } from "vue-i18n";

defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  icon: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue"]);
const { t } = useI18n();
</script>
