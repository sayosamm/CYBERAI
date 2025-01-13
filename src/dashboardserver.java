import spark.Spark;
import java.nio.file.*;
import java.util.*;

public class DashboardServer {
    public static void main(String[] args) throws Exception {
        Spark.port(4567);

        // Load anomaly results
        List<String> lines = Files.readAllLines(Paths.get("datasets/anomaly_results.csv"));

        Spark.get("/dashboard", (req, res) -> {
            StringBuilder response = new StringBuilder("<h1>Anomaly Detection Dashboard</h1><ul>");
            for (String line : lines) {
                response.append("<li>").append(line).append("</li>");
            }
            response.append("</ul>");
            return response.toString();
        });

        System.out.println("Dashboard running at http://localhost:4567/dashboard");
    }
}
