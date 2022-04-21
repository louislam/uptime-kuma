<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <!-- Change Password -->
            <template v-if="!settings.disableAuth">
                <p>
                    {{ $t("Current User") }}: <strong>{{ $root.username }}</strong>
                    <button v-if="! settings.disableAuth" id="logout-btn" class="btn btn-danger ms-4 me-2 mb-2" @click="$root.logout">{{ $t("Logout") }}</button>
                </p>

                <h5 class="my-4">{{ $t("Change Password") }}</h5>
                <form class="mb-3" @submit.prevent="savePassword">
                    <div class="mb-3">
                        <label for="current-password" class="form-label">
                            {{ $t("Current Password") }}
                        </label>
                        <input
                            id="current-password"
                            v-model="password.currentPassword"
                            type="password"
                            class="form-control"
                            required
                        />
                    </div>

                    <div class="mb-3">
                        <label for="new-password" class="form-label">
                            {{ $t("New Password") }}
                        </label>
                        <input
                            id="new-password"
                            v-model="password.newPassword"
                            type="password"
                            class="form-control"
                            required
                        />
                    </div>

                    <div class="mb-3">
                        <label for="repeat-new-password" class="form-label">
                            {{ $t("Repeat New Password") }}
                        </label>
                        <input
                            id="repeat-new-password"
                            v-model="password.repeatNewPassword"
                            type="password"
                            class="form-control"
                            :class="{ 'is-invalid': invalidPassword }"
                            required
                        />
                        <div class="invalid-feedback">
                            {{ $t("passwordNotMatchMsg") }}
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit">
                            {{ $t("Update Password") }}
                        </button>
                    </div>
                </form>
            </template>

            <div v-if="! settings.disableAuth" class="mt-5 mb-3">
                <h5 class="my-4">
                    {{ $t("Two Factor Authentication") }}
                </h5>
                <div class="mb-4">
                    <button
                        class="btn btn-primary me-2"
                        type="button"
                        @click="$refs.TwoFADialog.show()"
                    >
                        {{ $t("2FA Settings") }}
                    </button>
                </div>
            </div>

            <div class="my-4">
                <!-- Advanced -->
                <h5 class="my-4">{{ $t("Advanced") }}</h5>

                <div class="mb-4">
                    <button v-if="settings.disableAuth" id="enableAuth-btn" class="btn btn-outline-primary me-2 mb-2" @click="enableAuth">{{ $t("Enable Auth") }}</button>
                    <button v-if="! settings.disableAuth" id="disableAuth-btn" class="btn btn-primary me-2 mb-2" @click="confirmDisableAuth">{{ $t("Disable Auth") }}</button>
                </div>
            </div>
        </div>

        <TwoFADialog ref="TwoFADialog" />

        <Confirm ref="confirmDisableAuth" btn-style="btn-danger" :yes-text="$t('I understand, please disable')" :no-text="$t('Leave')" @yes="disableAuth">
            <template v-if="$i18n.locale === 'es-ES' ">
                <p>Seguro que deseas <strong>deshabilitar la autenticación</strong>?</p>
                <p>Es para <strong>quien implementa autenticación de terceros</strong> ante Uptime Kuma como por ejemplo Cloudflare Access.</p>
                <p>Por favor usar con cuidado.</p>
            </template>

            <template v-else-if="$i18n.locale === 'pt-BR' ">
                <p>Você tem certeza que deseja <strong>desativar a autenticação</strong>?</p>
                <p>Isso é para <strong>alguém que tem autenticação de terceiros</strong> na frente do 'UpTime Kuma' como o Cloudflare Access.</p>
                <p>Por favor, utilize isso com cautela.</p>
            </template>

            <template v-else-if="$i18n.locale === 'zh-HK' ">
                <p>你是否確認<strong>取消登入認証</strong>？</p>
                <p>這個功能是設計給已有<strong>第三方認証</strong>的用家，例如 Cloudflare Access。</p>
                <p>請小心使用。</p>
            </template>

            <template v-else-if="$i18n.locale === 'zh-CN' ">
                <p>是否确定 <strong>取消登录验证</strong>？</p>
                <p>这是为 <strong>有第三方认证</strong> 的用户提供的功能，如 Cloudflare Access</p>
                <p>请谨慎使用！</p>
            </template>

            <template v-else-if="$i18n.locale === 'zh-TW' ">
                <p>你是否要<strong>取消登入驗證</strong>？</p>
                <p>此功能是設計給已有<strong>第三方認證</strong>的使用者，例如 Cloudflare Access。</p>
                <p>請謹慎使用。</p>
            </template>

            <template v-else-if="$i18n.locale === 'de-DE' ">
                <p>Bist du sicher das du die <strong>Authentifizierung deaktivieren</strong> möchtest?</p>
                <p>Es ist für <strong>jemanden der eine externe Authentifizierung</strong> vor Uptime Kuma geschaltet hat, wie z.B. Cloudflare Access.</p>
                <p>Bitte mit Vorsicht nutzen.</p>
            </template>

            <template v-else-if="$i18n.locale === 'sl-SI' ">
                <p>Ali ste prepričani, da želite onemogočiti <strong>avtentikacijo</strong>?</p>
                <p>Namenjen je <strong>nekomu, ki ima pred programom Uptime Kuma vklopljeno zunanje preverjanje pristnosti</strong>, na primer Cloudflare Access.</p>
                <p>Uporabljajte previdno.</p>
            </template>

            <template v-else-if="$i18n.locale === 'sr' ">
                <p>Да ли сте сигурни да желите да <strong>искључите аутентификацију</strong>?</p>
                <p>То је за <strong>оне који имају додату аутентификацију</strong> испред Uptime Kuma као на пример Cloudflare Access.</p>
                <p>Молим Вас користите ово са пажњом.</p>
            </template>

            <template v-else-if="$i18n.locale === 'sr-latn' ">
                <p>Da li ste sigurni da želite da <strong>isključite autentifikaciju</strong>?</p>
                <p>To je za <strong>one koji imaju dodatu autentifikaciju</strong> ispred Uptime Kuma kao na primer Cloudflare Access.</p>
                <p>Molim Vas koristite ovo sa pažnjom.</p>
            </template>

            <template v-if="$i18n.locale === 'hr-HR' ">
                <p>Jeste li sigurni da želite <strong>isključiti autentikaciju</strong>?</p>
                <p>To je za <strong>korisnike koji imaju vanjsku autentikaciju stranice</strong> ispred Uptime Kume, poput usluge Cloudflare Access.</p>
                <p>Pažljivo koristite ovu opciju.</p>
            </template>

            <template v-else-if="$i18n.locale === 'tr-TR' ">
                <p><strong>Şifreli girişi devre dışı bırakmak istediğinizden</strong>emin misiniz?</p>
                <p>Bu, Uptime Kuma'nın önünde Cloudflare Access gibi <strong>üçüncü taraf yetkilendirmesi olan</strong> kişiler içindir.</p>
                <p>Lütfen dikkatli kullanın.</p>
            </template>

            <template v-else-if="$i18n.locale === 'ko-KR' ">
                <p>정말로 <strong>인증 기능을 끌까요</strong>?</p>
                <p>이 기능은 <strong>Cloudflare Access와 같은 서드파티 인증</strong>을 Uptime Kuma 앞에 둔 사용자를 위한 기능이에요.</p>
                <p>신중하게 사용하세요.</p>
            </template>

            <template v-else-if="$i18n.locale === 'pl' ">
                <p>Czy na pewno chcesz <strong>wyłączyć autoryzację</strong>?</p>
                <p>Jest przeznaczony dla <strong>kogoś, kto ma autoryzację zewnętrzną</strong> przed Uptime Kuma, taką jak Cloudflare Access.</p>
                <p>Proszę używać ostrożnie.</p>
            </template>

            <template v-else-if="$i18n.locale === 'et-EE' ">
                <p>Kas soovid <strong>lülitada autentimise välja</strong>?</p>
                <p>Kastuamiseks <strong>välise autentimispakkujaga</strong>, näiteks Cloudflare Access.</p>
                <p>Palun kasuta vastutustundlikult.</p>
            </template>

            <template v-else-if="$i18n.locale === 'it-IT' ">
                <p><strong>Disabilitare l'autenticazione?</strong></p>
                <p><strong>Questa opzione è per chi un sistema di autenticazione gestito da terze parti</strong> messo davanti ad Uptime Kuma, ad esempio Cloudflare Access.</p>
                <p>Utilizzare con attenzione!</p>
            </template>

            <template v-else-if="$i18n.locale === 'id-ID' ">
                <p>Apakah Anda yakin ingin <strong>menonaktifkan autentikasi</strong>?</p>
                <p>Ini untuk <strong>mereka yang memiliki autentikasi pihak ketiga</strong> diletakkan di depan Uptime Kuma, misalnya akses Cloudflare.</p>
                <p>Gunakan dengan hati-hati.</p>
            </template>

            <template v-else-if="$i18n.locale === 'ru-RU' ">
                <p>Вы уверены, что хотите <strong>отключить авторизацию</strong>?</p>
                <p>Это подходит для <strong>тех, у кого стоит другая авторизация</strong> перед открытием Uptime Kuma, например Cloudflare Access.</p>
                <p>Пожалуйста, используйте с осторожностью.</p>
            </template>

            <template v-else-if="$i18n.locale === 'uk-UA' ">
                <p>Ви впевнені, що бажаєте <strong>вимкнути авторизацію</strong>?</p>
                <p>Це підходить для <strong>тих, у кого встановлена інша авторизація</strong> пееред відкриттям Uptime Kuma, наприклад Cloudflare Access.</p>
                <p>Будь ласка, використовуйте з обережністю.</p>
            </template>

            <template v-else-if="$i18n.locale === 'fa' ">
                <p>آیا مطمئن هستید که میخواهید <strong>احراز هویت را غیر فعال کنید</strong>?</p>
                <p>این ویژگی برای کسانی است که <strong> لایه امنیتی شخص ثالث دیگر بر روی این آدرس فعال کرده‌اند</strong>، مانند Cloudflare Access.</p>
                <p>لطفا از این امکان با دقت استفاده کنید.</p>
            </template>

            <template v-else-if="$i18n.locale === 'bg-BG' ">
                <p>Сигурни ли сте, че желаете да <strong>изключите удостоверяването</strong>?</p>
                <p>Използва се в случаите, когато <strong>има настроен алтернативен метод за удостоверяване</strong> преди Uptime Kuma, например Cloudflare Access.</p>
                <p>Моля, използвайте с повишено внимание.</p>
            </template>

            <template v-else-if="$i18n.locale === 'hu' ">
                <p>Biztos benne, hogy <strong>kikapcsolja a hitelesítést</strong>?</p>
                <p>Akkor érdemes, ha <strong>van 3rd-party hitelesítés</strong> az Uptime Kuma-t megelőzően mint a Cloudflare Access.</p>
                <p>Használja megfontoltan!</p>
            </template>

            <template v-else-if="$i18n.locale === 'nb-NO' ">
                <p>Er du sikker på at du vil <strong>deaktiver autentisering</strong>?</p>
                <p>Dette er for <strong>de som har tredjepartsautorisering</strong> foran Uptime Kuma, for eksempel Cloudflare Access.</p>
                <p>Vennligst vær forsiktig.</p>
            </template>

            <template v-else-if="$i18n.locale === 'cs-CZ' ">
                <p>Opravdu chcete <strong>deaktivovat autentifikaci</strong>?</p>
                <p>Tato možnost je určena pro případy, kdy <strong>máte autentifikaci zajištěnou třetí stranou</strong> ještě před přístupem do Uptime Kuma, například prostřednictvím Cloudflare Access.</p>
                <p>Používejte ji prosím s rozmyslem.</p>
            </template>

            <template v-else-if="$i18n.locale === 'vi-VN' ">
                <p>Bạn có muốn <strong>TẮT XÁC THỰC</strong> không?</p>
                <p>Điều này rất nguy hiểm<strong>BẤT KỲ AI</strong> cũng có thể truy cập và cướp quyền điều khiển.</p>
                <p>Vui lòng <strong>cẩn thận</strong>.</p>
            </template>

            <!-- English (en) -->
            <template v-else>
                <p>Are you sure want to <strong>disable authentication</strong>?</p>
                <p>It is designed for scenarios <strong>where you intend to implement third-party authentication</strong> in front of Uptime Kuma such as Cloudflare Access, Authelia or other authentication mechanisms.</p>
                <p>Please use this option carefully!</p>
            </template>

            <div class="mb-3">
                <label for="current-password2" class="form-label">
                    {{ $t("Current Password") }}
                </label>
                <input
                    id="current-password2"
                    v-model="password.currentPassword"
                    type="password"
                    class="form-control"
                    required
                />
            </div>
        </Confirm>
    </div>
</template>

<script>
import Confirm from "../../components/Confirm.vue";
import TwoFADialog from "../../components/TwoFADialog.vue";

export default {
    components: {
        Confirm,
        TwoFADialog
    },

    data() {
        return {
            invalidPassword: false,
            password: {
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            }
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        }
    },

    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
    },

    methods: {
        savePassword() {
            if (this.password.newPassword !== this.password.repeatNewPassword) {
                this.invalidPassword = true;
            } else {
                this.$root
                    .getSocket()
                    .emit("changePassword", this.password, (res) => {
                        this.$root.toastRes(res);
                        if (res.ok) {
                            this.password.currentPassword = "";
                            this.password.newPassword = "";
                            this.password.repeatNewPassword = "";
                        }
                    });
            }
        },

        disableAuth() {
            this.settings.disableAuth = true;

            // Need current password to disable auth
            // Set it to empty if done
            this.saveSettings(() => {
                this.password.currentPassword = "";
                this.$root.username = null;
                this.$root.socket.token = "autoLogin";
            }, this.password.currentPassword);
        },

        enableAuth() {
            this.settings.disableAuth = false;
            this.saveSettings();
            this.$root.storage().removeItem("token");
            location.reload();
        },

        confirmDisableAuth() {
            this.$refs.confirmDisableAuth.show();
        },

    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

h5::after {
    content: "";
    display: block;
    width: 50%;
    padding-top: 8px;
    border-bottom: 1px solid $dark-border-color;
}
</style>
