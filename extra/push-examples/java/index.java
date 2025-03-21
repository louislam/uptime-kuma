import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Compile: javac index.java
 * Run: java Index
 */
class Index {

    public static final String PUSH_URL = "https://example.com/api/push/key?status=up&msg=OK&ping=";
    public static final int INTERVAL = 60;

    public static void main(String[] args) {
        while (true) {
            try {
                URL url = new URL(PUSH_URL);
                HttpURLConnection con = (HttpURLConnection) url.openConnection();
                con.setRequestMethod("GET");
                con.getResponseCode();
                con.disconnect();
                System.out.println("Pushed!");
            } catch (Exception e) {
                e.printStackTrace();
            }
            try {
                Thread.sleep(INTERVAL * 1000);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
