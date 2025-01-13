import java.io.*;
import java.util.*;

public class NetworkAnomalyDetector {
    public static void main(String[] args) throws IOException, ClassNotFoundException {
        // Load dataset
        List<String> lines = Files.readAllLines(Paths.get("datasets/network_traffic.csv"));
        List<double[]> data = new ArrayList<>();

        for (String line : lines.subList(1, lines.size())) {
            String[] parts = line.split(",");
            double[] row = Arrays.stream(parts).mapToDouble(Double::parseDouble).toArray();
            data.add(row);
        }

        // Load Isolation Forest model
        FileInputStream fileIn = new FileInputStream("models/anomaly_model.ser");
        ObjectInputStream objectIn = new ObjectInputStream(fileIn);
        IsolationForest model = (IsolationForest) objectIn.readObject();
        objectIn.close();

        // Predict anomalies
        for (double[] row : data) {
            boolean isAnomaly = model.predict(row);
            System.out.println("Row: " + Arrays.toString(row) + " - " + (isAnomaly ? "Anomaly" : "Normal"));
        }
    }
}
