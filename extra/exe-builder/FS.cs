using System.IO;
using System.Reflection;

namespace UptimeKuma {

    /**
     * Current Directory using App location
     */
    public class Directory {
        private static string baseDir;

        public static string FullPath(string path) {
            return Path.Combine(GetBaseDir(), path);
        }

        public static string GetBaseDir() {
            if (baseDir == null) {
                baseDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            }
            return baseDir;
        }

        public static bool Exists(string path) {
            return System.IO.Directory.Exists(FullPath(path));
        }

        public static void Delete(string path, bool recursive) {
            System.IO.Directory.Delete(FullPath(path), recursive);
        }

        public static void Move(string src, string dest) {
            System.IO.Directory.Move(FullPath(src), FullPath(dest));
        }

        public static string[] GetDirectories(string path) {
            return System.IO.Directory.GetDirectories(FullPath(path));
        }
    }

    public class File {

        private static string FullPath(string path) {
            return Directory.FullPath(path);
        }
        public static bool Exists(string path) {
            return System.IO.File.Exists(FullPath(path));
        }

        public static FileStream Create(string path) {
            return System.IO.File.Create(FullPath(path));
        }

        public static string ReadAllText(string path) {
            return System.IO.File.ReadAllText(FullPath(path));
        }

        public static void Delete(string path) {
            System.IO.File.Delete(FullPath(path));
        }

        public static void WriteAllText(string path, string content) {
            System.IO.File.WriteAllText(FullPath(path), content);
        }
    }
}
